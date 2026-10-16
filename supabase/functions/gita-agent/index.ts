import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { createFirebaseAuthorizer, HttpError } from "../_shared/gita-auth.mjs";
const authorizeGita = createFirebaseAuthorizer({projectId:Deno.env.get("GITA_FIREBASE_PROJECT_ID"),apiKey:Deno.env.get("GITA_FIREBASE_WEB_API_KEY")});

/* =========================================================
   GITA DATA TOOLS v3.1
   G-Smart UPPKB Guyangan

   Fitur:
   - Pertanyaan bebas melalui Gemini
   - Statistik periode
   - Multi-periode
   - Perbandingan periode
   - Analisis tren
   - Draft laporan
   - Universal Search:
       TNKB
       Ref Number
       Blanko
       BRIVA
   - Progres perkara
   - Detail pengiriman
   - Perhitungan irisan status berbasis case_id
   - Retry Gemini
   - Fallback jika Gemini sibuk
   - Database read-only
   ========================================================= */

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://uppkb-guyangan.github.io",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MONTHS: Record<string, string> = {
  januari: "01",
  februari: "02",
  maret: "03",
  april: "04",
  mei: "05",
  juni: "06",
  juli: "07",
  agustus: "08",
  september: "09",
  oktober: "10",
  november: "11",
  desember: "12",
};

const MONTH_NAMES: Record<string, string> = {
  "01": "Januari",
  "02": "Februari",
  "03": "Maret",
  "04": "April",
  "05": "Mei",
  "06": "Juni",
  "07": "Juli",
  "08": "Agustus",
  "09": "September",
  "10": "Oktober",
  "11": "November",
  "12": "Desember",
};

/* =========================================================
   RESPONSE
   ========================================================= */

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* =========================================================
   DETEKSI PERIODE
   ========================================================= */

function detectPeriods(question: string): string[] {
  const q = question.toLowerCase();

  const periods = new Set<string>();

  const years =
    q.match(/\b20\d{2}\b/g) ?? [];

  const defaultYear =
    years.length > 0
      ? years[years.length - 1]
      : new Date().getFullYear().toString();

  for (const [name, number] of Object.entries(MONTHS)) {
    if (!q.includes(name)) continue;

    const regex = new RegExp(
      `${name}\\s+(20\\d{2})`,
      "i",
    );

    const match =
      question.match(regex);

    const year =
      match?.[1] ?? defaultYear;

    periods.add(
      `${year}-${number}`,
    );
  }

  const numericMatches =
    q.matchAll(
      /\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/g,
    );

  for (const match of numericMatches) {
    periods.add(
      `${match[1]}-${match[2].padStart(2, "0")}`,
    );
  }

  return [...periods].sort();
}

function getMonthRange(period: string) {
  const [year, month] =
    period.split("-").map(Number);

  const nextYear =
    month === 12
      ? year + 1
      : year;

  const nextMonth =
    month === 12
      ? 1
      : month + 1;

  return {
    start:
      `${period}-01T00:00:00+07:00`,

    end:
      `${nextYear}-` +
      `${String(nextMonth).padStart(2, "0")}` +
      `-01T00:00:00+07:00`,
  };
}

function periodLabel(period: string) {
  const [year, month] =
    period.split("-");

  return `${MONTH_NAMES[month] ?? month} ${year}`;
}

/* =========================================================
   UNIVERSAL SEARCH DETECTION
   ========================================================= */

function detectTnkb(
  question: string,
): string | null {
  const match =
    question
      .toUpperCase()
      .match(
        /\b[A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{1,3}\b/,
      );

  if (!match) return null;

  return match[0].replace(
    /\s+/g,
    "",
  );
}

function detectRefNumber(
  question: string,
): string | null {
  const match =
    question
      .toUpperCase()
      .match(
        /\b[A-Z0-9]{2,6}-[A-Z0-9]{2,10}-[A-Z0-9]{3,12}\b/,
      );

  return match?.[0] ?? null;
}

function detectBlanko(
  question: string,
): string | null {
  const match =
    question
      .toUpperCase()
      .match(
        /(?:NO\.?\s*)?BLANKO\s*[:#-]?\s*([A-Z0-9/-]+)/,
      );

  return match?.[1] ?? null;
}

function detectBriva(
  question: string,
): string | null {
  const match =
    question
      .toUpperCase()
      .match(
        /BRIVA\s*[:#-]?\s*([0-9]{5,30})/,
      );

  return match?.[1] ?? null;
}

/* =========================================================
   INTENT
   ========================================================= */

function detectReportIntent(
  question: string,
) {
  const q =
    question.toLowerCase();

  return (
    q.includes("buat laporan") ||
    q.includes("buatkan laporan") ||
    q.includes("draft laporan") ||
    q.includes("laporan perkembangan") ||
    q.includes("laporan etle")
  );
}

function detectComparisonIntent(
  question: string,
  periodCount: number,
) {
  const q =
    question.toLowerCase();

  return (
    periodCount >= 2 ||
    q.includes("bandingkan") ||
    q.includes("perbandingan") ||
    q.includes("dibanding") ||
    q.includes("dibandingkan") ||
    q.includes("tren")
  );
}

/* =========================================================
   MAIN
   ========================================================= */

Deno.serve(async (req: Request) => {
  /* =======================================================
     CORS
     ======================================================= */

  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      },
    );
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error:
          "Method tidak diizinkan.",
      },
      405,
    );
  }

  try {
    if (req.headers.get("origin") && req.headers.get("origin") !== "https://uppkb-guyangan.github.io") throw new HttpError(403,"FORBIDDEN_ORIGIN");
    const actor = await authorizeGita(req);
    const privilegedReader = ["ADMIN","WASATPEL"].includes(actor.role);

    /* =====================================================
       INPUT
       ===================================================== */

    const body =
      await req.json();

    const question =
      String(
        body?.question || "",
      )
        .trim()
        .slice(0, 4000);

    if (!question) {
      return jsonResponse(
        {
          error:
            "Pertanyaan tidak boleh kosong.",
        },
        400,
      );
    }

    /* =====================================================
       ENVIRONMENT
       ===================================================== */

    const geminiApiKey =
      Deno.env.get(
        "GEMINI_API_KEY",
      );

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const publishableKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      );

    if (
      !geminiApiKey ||
      !supabaseUrl ||
      !publishableKey
    ) {
      return jsonResponse(
        {
          error:
            "Konfigurasi backend GITA belum lengkap.",
        },
        500,
      );
    }

    /* =====================================================
       SUPABASE CLIENT
       ===================================================== */

    const supabase =
      createClient(
        supabaseUrl,
        publishableKey,
        {
          global: { headers: { Authorization: "Bearer " + actor.token } },
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        },
      );

    /* =====================================================
       DETECTION
       ===================================================== */

    const periods =
      detectPeriods(question);

    const reportIntent =
      detectReportIntent(
        question,
      );

    const comparisonIntent =
      detectComparisonIntent(
        question,
        periods.length,
      );

    const tnkb =
      detectTnkb(question);

    const refNumber =
      detectRefNumber(
        question,
      );

    const blanko =
      detectBlanko(question);

    const briva =
      detectBriva(question);
    if (briva && !privilegedReader) throw new HttpError(403,"FORBIDDEN");

    /* =====================================================
       DATA CONTEXT
       ===================================================== */

    const dataContext:
      Record<string, any> = {
        source:
          "G-Smart Supabase",

        access:
          "read-only",
      };

    /* =====================================================
       PERIOD STATISTICS
       ===================================================== */

    const statistics:
      any[] = [];

    async function getPeriodStatistics(
      period: string,
    ) {
      const range =
        getMonthRange(
          period,
        );

      const {
        data: cases,
        error: caseError,
      } = await supabase
        .from("etle_cases")
        .select(`
          case_id,
          ref_number,
          tnkb,
          no_blanko,
          no_briva,
          status_etle,
          status_bayar,
          jenis_pelanggaran,
          tanggal_sidang
        `)
        .gte(
          "tanggal_pelanggaran",
          range.start,
        )
        .lt(
          "tanggal_pelanggaran",
          range.end,
        );

      if (caseError) {
        throw new Error(
          `Gagal membaca etle_cases: ${caseError.message}`,
        );
      }

      /* ===================================================
         UNIQUE CASE
         =================================================== */

      const uniqueCases =
        new Map<
          string,
          any
        >();

      for (
        const row
        of cases ?? []
      ) {
        if (
          !row.case_id
        ) {
          continue;
        }

        uniqueCases.set(
          row.case_id,
          row,
        );
      }

      const rows =
        [
          ...uniqueCases.values(),
        ];

      const caseIds =
        [
          ...uniqueCases.keys(),
        ];

      /* ===================================================
         RELATED CASE IDS
         =================================================== */

      async function relatedIds(
        tableName: string,
      ): Promise<
        Set<string>
      > {
        if (
          caseIds.length === 0
        ) {
          return new Set<
            string
          >();
        }

        const {
          data,
          error,
        } = await supabase
          .from(
            tableName,
          )
          .select(
            "case_id",
          )
          .in(
            "case_id",
            caseIds,
          );

        if (error) {
          throw new Error(
            `Gagal membaca ${tableName}: ${error.message}`,
          );
        }

        return new Set(
          (data ?? [])
            .map(
              (
                row: any,
              ) =>
                row.case_id,
            )
            .filter(
              Boolean,
            ),
        );
      }

      const [
        shippingIds,
        disputeIds,
        terminatedIds,
        courtIds,
        paymentIds,
      ] =
        await Promise.all(
          [
            relatedIds(
              "etle_shipping",
            ),

            relatedIds(
              "etle_disputes",
            ),

            relatedIds(
              "etle_terminated_cases",
            ),

            relatedIds(
              "etle_court_info",
            ),

            relatedIds(
              "etle_payments",
            ),
          ],
        );

      /* ===================================================
         BLANKO IDS
         =================================================== */

      const blankoIds =
        new Set(
          rows
            .filter(
              (
                row: any,
              ) =>
                row.no_blanko &&
                String(
                  row.no_blanko,
                ).trim() !== "",
            )
            .map(
              (
                row: any,
              ) =>
                row.case_id,
            )
            .filter(
              Boolean,
            ),
        );

      /* ===================================================
         ACTIVE DISPUTES

         Perkara tersanggah yang sudah dihentikan
         tidak lagi dihitung sebagai tersanggah aktif.
         =================================================== */

      const activeDisputeIds =
        [
          ...disputeIds,
        ].filter(
          (
            id,
          ) =>
            !terminatedIds.has(
              id,
            ),
        );

      /* ===================================================
         STATUS INTERSECTIONS
         =================================================== */

      const courtAndPaymentIds =
        [
          ...courtIds,
        ].filter(
          (
            id,
          ) =>
            paymentIds.has(
              id,
            ),
        );

      const blankoAndCourtIds =
        [
          ...blankoIds,
        ].filter(
          (
            id,
          ) =>
            courtIds.has(
              id,
            ),
        );

      const blankoAndPaymentIds =
        [
          ...blankoIds,
        ].filter(
          (
            id,
          ) =>
            paymentIds.has(
              id,
            ),
        );

      const blankoCourtPaymentIds =
        [
          ...blankoIds,
        ].filter(
          (
            id,
          ) =>
            courtIds.has(
              id,
            ) &&
            paymentIds.has(
              id,
            ),
        );

      /* ===================================================
         UNIQUE TNKB
         =================================================== */

      const uniqueTnkb =
        new Set(
          rows
            .map(
              (
                row: any,
              ) =>
                row.tnkb,
            )
            .filter(
              Boolean,
            ),
        ).size;

      /* ===================================================
         BACKEND PERCENTAGES
         =================================================== */

      const shippingPercentage =
        rows.length > 0
          ? Number(
              (
                (
                  shippingIds.size /
                  rows.length
                ) *
                100
              ).toFixed(
                2,
              ),
            )
          : 0;

      const blankoPercentage =
        rows.length > 0
          ? Number(
              (
                (
                  blankoIds.size /
                  rows.length
                ) *
                100
              ).toFixed(
                2,
              ),
            )
          : 0;

      const paymentPercentage =
        rows.length > 0
          ? Number(
              (
                (
                  paymentIds.size /
                  rows.length
                ) *
                100
              ).toFixed(
                2,
              ),
            )
          : 0;

      /* ===================================================
         RETURN STATISTICS
         =================================================== */

      return {
        periode:
          period,

        label:
          periodLabel(
            period,
          ),

        definisi:
          "Perkara dipilih berdasarkan tanggal_pelanggaran. " +
          "Status terkait dihitung berdasarkan case_id perkara " +
          "yang berada pada periode tersebut.",

        total_perkara:
          rows.length,

        total_tnkb:
          uniqueTnkb,

        pengiriman_surat:
          shippingIds.size,

        persentase_pengiriman:
          shippingPercentage,

        blanko_tilang:
          blankoIds.size,

        persentase_blanko:
          blankoPercentage,

        tersanggah:
          activeDisputeIds.length,

        dihentikan:
          terminatedIds.size,

        persidangan:
          courtIds.size,

        pembayaran:
          paymentIds.size,

        persentase_pembayaran:
          paymentPercentage,

        /*
         * Nilai di bawah adalah irisan case_id.
         * Aman digunakan untuk menyimpulkan bahwa
         * perkara yang sama berada pada kedua/ketiga tahap.
         */

        persidangan_dan_pembayaran:
          courtAndPaymentIds.length,

        blanko_dan_persidangan:
          blankoAndCourtIds.length,

        blanko_dan_pembayaran:
          blankoAndPaymentIds.length,

        blanko_persidangan_dan_pembayaran:
          blankoCourtPaymentIds.length,
      };
    }

    /* =====================================================
       LOAD ALL REQUESTED PERIODS
       ===================================================== */

    for (
      const period
      of periods
    ) {
      statistics.push(
        await getPeriodStatistics(
          period,
        ),
      );
    }

    if (
      statistics.length > 0
    ) {
      dataContext.statistik =
        statistics;
    }

    /* =====================================================
       PERIOD COMPARISON
       ===================================================== */

    if (
      statistics.length >= 2
    ) {
      const comparisons:
        any[] = [];

      for (
        let i = 1;
        i <
        statistics.length;
        i++
      ) {
        const previous =
          statistics[
            i - 1
          ];

        const current =
          statistics[i];

        const difference =
          current.total_perkara -
          previous.total_perkara;

        const percentage =
          previous.total_perkara >
          0
            ? Number(
                (
                  (
                    difference /
                    previous.total_perkara
                  ) *
                  100
                ).toFixed(
                  2,
                ),
              )
            : null;

        comparisons.push(
          {
            dari:
              previous.label,

            ke:
              current.label,

            total_sebelumnya:
              previous.total_perkara,

            total_sekarang:
              current.total_perkara,

            selisih:
              difference,

            perubahan_persen:
              percentage,

            arah:
              difference > 0
                ? "naik"
                : difference < 0
                ? "turun"
                : "tetap",
          },
        );
      }

      dataContext.perbandingan =
        comparisons;
    }

    /* =====================================================
       UNIVERSAL SEARCH
       ===================================================== */

    let searchType:
      string | null =
        null;

    let searchValue:
      string | null =
        null;

    let foundCases:
      any[] = [];

    /*
     * Prioritas:
     * Ref Number
     * Blanko
     * BRIVA
     * TNKB
     */

    if (refNumber) {
      searchType =
        "ref_number";

      searchValue =
        refNumber;

      const {
        data,
        error,
      } = await supabase
        .from(
          "etle_cases",
        )
        .select("*")
        .ilike(
          "ref_number",
          `%${refNumber}%`,
        )
        .limit(20);

      if (error) {
        throw error;
      }

      foundCases =
        data ?? [];
    }

    else if (blanko) {
      searchType =
        "blanko";

      searchValue =
        blanko;

      const {
        data,
        error,
      } = await supabase
        .from(
          "etle_cases",
        )
        .select("*")
        .ilike(
          "no_blanko",
          `%${blanko}%`,
        )
        .limit(20);

      if (error) {
        throw error;
      }

      foundCases =
        data ?? [];
    }

    else if (briva) {
      searchType =
        "briva";

      searchValue =
        briva;

      const {
        data,
        error,
      } = await supabase
        .from(
          "etle_cases",
        )
        .select("*")
        .ilike(
          "no_briva",
          `%${briva}%`,
        )
        .limit(20);

      if (error) {
        throw error;
      }

      foundCases =
        data ?? [];
    }

    else if (tnkb) {
      searchType =
        "tnkb";

      searchValue =
        tnkb;

      const {
        data,
        error,
      } = await supabase
        .from(
          "etle_cases",
        )
        .select("*")
        .ilike(
          "tnkb",
          `%${tnkb}%`,
        )
        .order(
          "tanggal_pelanggaran",
          {
            ascending:
              false,
          },
        )
        .limit(20);

      if (error) {
        throw error;
      }

      foundCases =
        data ?? [];
    }

    /* =====================================================
       CASE PROGRESS
       ===================================================== */

    if (
      foundCases.length >
      0
    ) {
      const caseIds = [
        ...new Set(
          foundCases
            .map(
              (
                row: any,
              ) =>
                row.case_id,
            )
            .filter(
              Boolean,
            ),
        ),
      ];

      async function getRelated(
        tableName: string,
      ) {
        if (
          caseIds.length ===
          0
        ) {
          return [];
        }

        const {
          data,
          error,
        } = await supabase
          .from(
            tableName,
          )
          .select("*")
          .in(
            "case_id",
            caseIds,
          );

        if (error) {
          console.error(
            `Gagal membaca ${tableName}:`,
            error.message,
          );

          return [];
        }

        return data ?? [];
      }

      const [
        shipping,
        disputes,
        terminated,
        courts,
        payments,
      ] =
        await Promise.all(
          [
            getRelated(
              "etle_shipping",
            ),

            getRelated(
              "etle_disputes",
            ),

            getRelated(
              "etle_terminated_cases",
            ),

            getRelated(
              "etle_court_info",
            ),

            privilegedReader ? getRelated("etle_payments") : Promise.resolve([]),
          ],
        );

      /* ===================================================
         SANITIZE CASES
         UUID case_id tidak dikirim ke Gemini.
         =================================================== */

      const sanitizedCases =
        foundCases.map(
          (
            row: any,
          ) => ({
            ref_number:
              row.ref_number,

            tnkb:
              row.tnkb,

            jenis_pelanggaran:
              row.jenis_pelanggaran,

            tanggal_pelanggaran:
              row.tanggal_pelanggaran,

            lokasi:
              row.lokasi,

            status_etle:
              row.status_etle,

            status_bayar:
              privilegedReader ? row.status_bayar : undefined,

            no_blanko:
              row.no_blanko,

            no_briva:
              privilegedReader ? row.no_briva : undefined,

            tanggal_blanko:
              row.tanggal_blanko,

            tanggal_sidang:
              row.tanggal_sidang,
          }),
        );

      /* ===================================================
         SHIPPING DETAIL
         =================================================== */

      const shippingInfo =
        shipping.map(
          (
            row: any,
          ) => ({
            tracking_number:
              row.tracking_number,

            courier:
              row.courier,

            status:
              row.status,

            status_description:
              row.status_description,

            printed_at:
              row.printed_at,

            shipped_at:
              row.shipped_at,

            delivered_at:
              row.delivered_at,

            returned_at:
              row.returned_at,

            failed_at:
              row.failed_at,

            last_event_at:
              row.last_event_at,
          }),
        );

      /* ===================================================
         SEARCH RESULT
         =================================================== */

      dataContext.pencarian_perkara =
        {
          tipe_pencarian:
            searchType,

          kata_kunci:
            searchValue,

          jumlah_ditemukan:
            sanitizedCases.length,

          perkara:
            sanitizedCases,

          progres: {
            pengiriman_surat:
              shipping.length >
              0,

            jumlah_record_pengiriman:
              shipping.length,

            detail_pengiriman:
              shippingInfo,

            tersanggah:
              disputes.length >
                0 &&
              terminated.length ===
                0,

            jumlah_record_sanggahan:
              disputes.length,

            dihentikan:
              terminated.length >
              0,

            jumlah_record_dihentikan:
              terminated.length,

            persidangan:
              courts.length >
              0,

            jumlah_record_persidangan:
              courts.length,

            pembayaran:
              payments.length >
              0,

            jumlah_record_pembayaran:
              payments.length,
          },
        };
    }

    else if (
      searchType &&
      searchValue
    ) {
      dataContext.pencarian_perkara =
        {
          tipe_pencarian:
            searchType,

          kata_kunci:
            searchValue,

          jumlah_ditemukan:
            0,

          perkara:
            [],
        };
    }

    /* =====================================================
       INTENT CONTEXT
       ===================================================== */

    dataContext.intent = {
      laporan:
        reportIntent,

      perbandingan:
        comparisonIntent,

      jumlah_periode:
        periods.length,
    };

    /* =====================================================
       SYSTEM INSTRUCTION
       ===================================================== */

    const systemInstruction = `
Anda adalah GITA
(Guyangan Intelligent Transportation Assistant),
asisten AI internal aplikasi G-Smart
UPPKB Guyangan.

IDENTITAS:
- Nama Anda GITA.
- Anda membantu petugas UPPKB Guyangan.
- Anda merupakan asisten AI di aplikasi G-Smart.
- Zona waktu operasional adalah WIB / Asia Jakarta.

BAHASA:
Gunakan Bahasa Indonesia.

GAYA KOMUNIKASI:
- Profesional.
- Ramah.
- Natural.
- Jelas.
- Ringkas tetapi informatif.
- Jangan selalu membuka jawaban dengan "Halo".
- Jangan menggunakan kalimat penutup yang sama berulang kali.
- Untuk laporan pimpinan gunakan bahasa kedinasan yang formal,
  objektif, dan mudah diperiksa.

SUMBER KEBENARAN:
DATA G-SMART yang diberikan kepada Anda berasal dari
database Supabase G-Smart secara read-only.

DATA G-SMART adalah sumber kebenaran untuk angka dan
informasi ETLE dalam jawaban ini.

ATURAN UTAMA:
1. Jangan mengarang data.
2. Jangan mengarang angka.
3. Gunakan angka backend apa adanya.
4. Jangan mengubah angka yang diberikan backend.
5. Jika data tidak tersedia, katakan data belum tersedia.
6. Jangan mengklaim telah mengubah database.
7. Jangan mengklaim telah mengirim pesan atau dokumen.
8. Jangan mengklaim telah membuat file jika file belum dibuat.
9. Jangan menampilkan UUID internal.
10. Jangan menampilkan API key, secret, service role key,
    atau informasi autentikasi lainnya.
11. Jangan menyimpulkan dua status dimiliki perkara yang sama
    hanya karena jumlahnya sama.
12. Hubungan antarstatus hanya boleh dinyatakan apabila backend
    menyediakan nilai irisan status tersebut.
13. Gunakan persentase yang disediakan backend.
14. Jangan menghitung ulang persentase yang sudah tersedia.
15. Bedakan fakta database dengan interpretasi atau analisis.
16. Akses GITA saat ini adalah read-only.

WAKTU:
- Timestamp database dapat menggunakan UTC.
- Jika waktu ditampilkan kepada pengguna, jelaskan dalam WIB
  / Asia Jakarta.

STATISTIK:
- statistik.total_perkara adalah jumlah perkara unik berdasarkan
  case_id pada periode tersebut.
- statistik.total_tnkb adalah jumlah TNKB unik.
- statistik.pengiriman_surat adalah jumlah perkara yang memiliki
  record pengiriman.
- statistik.persentase_pengiriman dihitung backend.
- statistik.tersanggah adalah sanggahan aktif yang tidak termasuk
  perkara yang sudah dihentikan.
- statistik.dihentikan adalah perkara yang terdapat pada tabel
  penghentian.
- statistik.persidangan adalah perkara yang terdapat pada data
  persidangan.
- statistik.pembayaran adalah perkara yang terdapat pada data
  pembayaran.

IRISAN STATUS:
- persidangan_dan_pembayaran berarti case_id yang benar-benar
  terdapat pada kedua tahap: persidangan DAN pembayaran.
- blanko_dan_persidangan berarti case_id yang benar-benar memiliki
  blanko DAN terdapat pada persidangan.
- blanko_dan_pembayaran berarti case_id yang benar-benar memiliki
  blanko DAN terdapat pada pembayaran.
- blanko_persidangan_dan_pembayaran berarti case_id yang
  benar-benar memiliki blanko DAN terdapat pada persidangan
  DAN pembayaran.

Contoh:
Jika persidangan = 11 dan pembayaran = 11 tetapi
persidangan_dan_pembayaran = 8,
Anda TIDAK BOLEH mengatakan seluruh 11 perkara persidangan
sudah melakukan pembayaran.
Yang boleh dikatakan adalah 8 perkara tercatat pada kedua tahap.

PERBANDINGAN:
Jika data perbandingan tersedia:
- gunakan nilai selisih dari backend;
- gunakan perubahan_persen dari backend;
- jelaskan arah naik, turun, atau tetap.

Jika hanya satu periode dan intent.perbandingan = false,
JANGAN mengatakan data pembanding tidak tersedia,
kecuali pengguna memang meminta perbandingan.

LAPORAN:
Jika intent.laporan = true,
buat DRAFT laporan berdasarkan DATA G-SMART.

Struktur yang disarankan:

LAPORAN PERKEMBANGAN PENANGANAN ETLE
UPPKB GUYANGAN

Periode: ...

I. Ringkasan

II. Data Utama

III. Analisis dan Perkembangan

IV. Kesimpulan

Untuk laporan:
- gunakan bahasa formal;
- jangan membuat fakta yang tidak tersedia;
- jangan menghubungkan dua status hanya karena jumlahnya sama;
- gunakan irisan case_id jika membahas kesinambungan tahapan;
- gunakan persentase backend jika tersedia;
- jangan menyebut "seluruh perkara" kecuali data irisan memang
  membuktikan hal tersebut.

PENCARIAN PERKARA:
Jika pencarian_perkara tersedia:
- jelaskan perkara berdasarkan data tersebut;
- gunakan detail_pengiriman jika tersedia;
- jangan tampilkan UUID internal;
- jika hasil pencarian kosong, katakan data tidak ditemukan.

DATA G-SMART:
${JSON.stringify(dataContext)}
`;

    /* =====================================================
       GEMINI + RETRY
       ===================================================== */

    let result:
      any = null;

    let geminiOk =
      false;

    let lastError =
      "";

    const retryDelays = [
      0,
      1200,
      2500,
    ];

    for (
      let attempt = 0;
      attempt <
      retryDelays.length;
      attempt++
    ) {
      if (
        retryDelays[
          attempt
        ] > 0
      ) {
        await sleep(
          retryDelays[
            attempt
          ],
        );
      }

      try {
        const response =
          await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
              method:
                "POST",

              headers: {
                "x-goog-api-key":
                  geminiApiKey,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    model:
                      "gemini-3.8-flash",

                    system_instruction:
                      systemInstruction,

                    input:
                      question,

                    generation_config:
                      {
                        thinking_level:
                          "low",

                        temperature:
                          0.2,
                      },
                  },
                ),
            },
          );

        result =
          await response.json();

        if (
          response.ok
        ) {
          geminiOk =
            true;

          break;
        }

        lastError =
          result
            ?.error
            ?.message ??
          "Gemini API error";

        /*
         * Retry untuk:
         * - 429
         * - server error / overload 5xx
         */

        if (
          response.status !==
            429 &&
          response.status <
            500
        ) {
          break;
        }
      }

      catch (error) {
        lastError =
          error instanceof Error
            ? error.message
            : String(
                error,
              );
      }
    }

    /* =====================================================
       FALLBACK
       ===================================================== */

    if (!geminiOk) {
      return jsonResponse(
        {
          success:
            true,

          provider:
            "g-smart-fallback",

          model:
            null,

          interaction_id:
            null,

          tools: {
            version:
              "GITA Data Tools v3.1",

            periods_detected:
              periods,

            search: {
              type:
                searchType,

              value:
                searchValue,
            },

            database_access:
              "read-only",

            gemini_status:
              "temporarily_unavailable",
          },

          data_context:
            dataContext,

          answer:
            "Data G-Smart berhasil dibaca, tetapi layanan AI GITA sedang sibuk. Data hasil pencarian tetap tersedia. Silakan coba kembali beberapa saat lagi.",

          ai_error:
            lastError,
        },
      );
    }

    /* =====================================================
       PARSE GEMINI RESPONSE
       ===================================================== */

    let answer =
      result?.output_text;

    if (
      !answer &&
      Array.isArray(
        result?.steps,
      )
    ) {
      const texts:
        string[] = [];

      for (
        const step
        of result.steps
      ) {
        if (
          !Array.isArray(
            step?.content,
          )
        ) {
          continue;
        }

        for (
          const content
          of step.content
        ) {
          if (
            content?.type ===
              "text" &&
            typeof content?.text ===
              "string"
          ) {
            texts.push(
              content.text,
            );
          }
        }
      }

      answer =
        texts
          .join("\n")
          .trim();
    }

    if (!answer) {
      answer =
        "Data G-Smart berhasil dibaca, tetapi GITA belum menghasilkan narasi.";
    }

    /* =====================================================
       FINAL RESPONSE
       ===================================================== */

    return jsonResponse(
      {
        success:
          true,

        provider:
          "gemini",

        model:
          "gemini-3.8-flash",

        interaction_id:
          result?.id ??
          null,

        tools: {
          version:
            "GITA Data Tools v3.1",

          periods_detected:
            periods,

          search: {
            type:
              searchType,

            value:
              searchValue,
          },

          database_access:
            "read-only",

          gemini_status:
            "available",
        },

        data_context:
          dataContext,

        answer,
      },
    );
  }

  catch (error) {
    if (error instanceof HttpError) return jsonResponse({success:false,error:error.message},error.status);
    console.warn("GITA request failed");

    return jsonResponse(
      {
        success:
          false,

        error:
          "Terjadi kesalahan pada GITA.",

        detail:
          "Layanan sementara tidak tersedia.",
      },
      500,
    );
  }
});

// Servidor Express rodando em Bun para consultar produtos da Amazon
// Endpoint principal: GET /api/scrape?keyword=TERMO

import "dotenv/config";
import express from "express";
import axios from "axios";
import { JSDOM } from "jsdom";
import cors from "cors";
// Sem PA-API: apenas scraping

const app = express();
const PORT = process.env.PORT || 3001;

// Habilita CORS para facilitar o consumo pelo frontend local (Vite)
app.use(cors());

// Configuração de scraping
const MARKET_BASE_URL =
  process.env.MARKETPLACE_BASE_URL || "https://www.amazon.com";
const DEFAULT_SEARCH_TERM = process.env.DEFAULT_SEARCH_TERM || "headphones";
const FALLBACK_KEYWORDS = (
  process.env.FALLBACK_KEYWORDS || "laptop,usb,keyboard,monitor,mouse"
)
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

// Healthcheck simples
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Endpoint de scraping
app.get("/api/scrape", async (req, res) => {
  const { keyword } = req.query;

  const finalKeyword =
    (keyword && String(keyword).trim()) || DEFAULT_SEARCH_TERM;
  const originalKeywordProvided = Boolean(
    keyword && String(keyword).trim().length > 0
  );

  try {
    // Helper para raspar um termo específico
    const scrapeFor = async (term) => {
      const searchUrl = new URL("/s", MARKET_BASE_URL);
      searchUrl.searchParams.set("k", term);

      const response = await axios.get(searchUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          // Linguagem ampla para reduzir variações regionais
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          Referer: MARKET_BASE_URL,
          "Upgrade-Insecure-Requests": "1",
        },
        timeout: 20000,
        maxRedirects: 5,
      });

      const dom = new JSDOM(response.data);
      const document = dom.window.document;

      // Sinais de CAPTCHA/bloqueio
      const captcha = document.querySelector(
        'form[action*="validateCaptcha"], #captchacharacters'
      );
      if (captcha) return { captcha: true, products: [] };

      const products = [];
      // Seleção robusta de cards de resultado
      let items = document.querySelectorAll(
        'div[data-component-type="s-search-result"]'
      );
      if (!items || items.length === 0) {
        items = document.querySelectorAll(
          'div.s-result-item[data-asin]:not([data-asin=""])'
        );
      }
      items.forEach((el) => {
        // Muitos blocos editoriais/Prime Video não possuem ASIN, então ignoramos
        const asin = el.getAttribute("data-asin");
        if (!asin) return;

        const titleEl = el.querySelector("h2 a span");
        const title = titleEl ? titleEl.textContent.trim() : null;
        const anchorEl = el.querySelector("h2 a");
        let url = null;
        if (anchorEl) {
          const href = anchorEl.getAttribute("href") || "";
          if (href) {
            try {
              url = new URL(href, MARKET_BASE_URL).toString();
            } catch (_) {}
          }
        }
        // Se não obtivemos uma URL de produto, gera a partir do ASIN
        if (!url || !/\/dp\//.test(url)) {
          try {
            url = new URL(`/dp/${asin}`, MARKET_BASE_URL).toString();
          } catch (_) {}
        }

        // Filtra conteúdos não-produto (ex.: Prime Video, Audible, Música, Apps)
        const urlLower = (url || "").toLowerCase();
        const titleLower = (title || "").toLowerCase();
        const isNonProduct =
          urlLower.includes("primevideo") ||
          urlLower.includes("/gp/video") ||
          urlLower.includes("/watch/") ||
          urlLower.includes("audible") ||
          urlLower.includes("music") ||
          urlLower.includes("apps") ||
          titleLower.includes("prime video") ||
          titleLower.includes("audible");
        if (isNonProduct) return;
        const ratingEl = el.querySelector("span.a-icon-alt");
        let rating = null;
        if (ratingEl) {
          const text = ratingEl.textContent.trim();
          const enMatch = text.match(/([\d.]+)\s+out of 5/);
          const ptMatch = text.match(/([\d,]+)\s+de 5/);
          if (enMatch) rating = parseFloat(enMatch[1]);
          else if (ptMatch) rating = parseFloat(ptMatch[1].replace(",", "."));
        }
        let reviews = null;
        const reviewsEl = el.querySelector(
          'span[aria-label$="ratings"], span[aria-label$="rating"], span.a-size-base.s-underline-text'
        );
        if (reviewsEl) {
          const digits = reviewsEl.textContent.replace(/[^\d]/g, "");
          if (digits) reviews = parseInt(digits, 10);
        }
        const imgEl = el.querySelector("img.s-image");
        const image = imgEl ? imgEl.src : null;
        if (title) products.push({ title, rating, reviews, image, url });
      });

      return { captcha: false, products };
    };

    // Se o usuário forneceu keyword, retornamos apenas daquele termo
    if (originalKeywordProvided) {
      const { captcha, products } = await scrapeFor(finalKeyword);
      if (captcha) {
        return res.status(503).json({
          error: "Captcha detectado pela Amazon. Tente novamente mais tarde.",
        });
      }
      return res.json({
        keyword: finalKeyword,
        count: products.length,
        products,
      });
    }

    // Sem keyword: agregamos resultados de múltiplos termos (DEFAULT + FALLBACKS)
    const tried = new Set();
    const orderedTerms = [finalKeyword, ...FALLBACK_KEYWORDS].filter((t) => {
      const key = t.toLowerCase();
      if (tried.has(key)) return false;
      tried.add(key);
      return true;
    });

    const seen = new Set();
    const aggregate = [];
    for (const term of orderedTerms) {
      const { captcha, products } = await scrapeFor(term);
      if (captcha) {
        return res.status(503).json({
          error: "Captcha detectado pela Amazon. Tente novamente mais tarde.",
        });
      }
      for (const p of products) {
        const dedupeKey = p.url || `${p.title}::${p.image || ""}`;
        if (!dedupeKey) continue;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        aggregate.push(p);
      }
    }

    return res.json({
      keyword: "",
      count: aggregate.length,
      products: aggregate,
    });
  } catch (err) {
    console.error(err?.message || err);
    const raw =
      err?.response?.text || err?.response?.body || err?.response?.data;
    if (raw && typeof raw === "string") {
      console.error("Resposta não-JSON (início):", raw.slice(0, 300));
    }
    if (axios.isAxiosError(err)) {
      return res.status(502).json({
        error: "Falha ao buscar dados da Amazon",
        details: err.message,
      });
    }
    return res.status(500).json({
      error: "Erro inesperado ao processar a requisição",
      details: (err && err.message) || String(err),
    });
  }
});

// 404 padrão
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});

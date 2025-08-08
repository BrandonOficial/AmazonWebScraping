// Frontend simples (Vanilla JS) para consumir o endpoint /api/scrape e exibir os resultados

const API_URL = "http://localhost:3001/api/scrape";

const keywordInput = document.getElementById("keyword");
const searchBtn = document.getElementById("searchBtn");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "status";
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "card";

  const img = document.createElement("img");
  img.className = "thumb";
  img.alt = product.title || "Produto";
  if (product.image) img.src = product.image;

  const title = document.createElement("h3");
  if (product.url) {
    const a = document.createElement("a");
    a.href = product.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = product.title || "Sem título";
    title.appendChild(a);
  } else {
    title.textContent = product.title || "Sem título";
  }

  const meta = document.createElement("p");
  meta.className = "meta";
  const ratingText =
    product.rating != null ? `${product.rating} / 5` : "Sem avaliação";
  const reviewsText =
    product.reviews != null
      ? `${product.reviews} avaliações`
      : "Sem nº de avaliações";
  meta.textContent = `${ratingText} · ${reviewsText}`;

  card.appendChild(img);
  card.appendChild(title);
  card.appendChild(meta);
  return card;
}

async function fetchProducts(keyword) {
  setStatus("Buscando resultados…");
  resultsEl.innerHTML = "";

  try {
    const url = `${API_URL}?keyword=${encodeURIComponent(keyword)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Falha na requisição (HTTP ${res.status})`);
    }

    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];

    clearStatus();
    if (products.length === 0) {
      setStatus("Nenhum item encontrado. Tente outra palavra-chave.", "warn");
      return;
    }

    const fragment = document.createDocumentFragment();
    products.forEach((p) => fragment.appendChild(createProductCard(p)));
    resultsEl.appendChild(fragment);
  } catch (error) {
    setStatus(error.message || "Erro inesperado.", "error");
  }
}

searchBtn.addEventListener("click", () => {
  const keyword = keywordInput.value.trim();
  fetchProducts(keyword);
});

keywordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchBtn.click();
  }
});

// Busca inicial ao carregar (sem keyword -> backend usará DEFAULT_SEARCH_TERM)
window.addEventListener("DOMContentLoaded", () => {
  fetchProducts("");
});

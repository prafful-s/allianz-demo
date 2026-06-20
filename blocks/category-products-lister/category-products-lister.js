import { readBlockConfig, createProductImage } from "../../scripts/aem.js";
import { isAuthorEnvironment, normalizeAemPath, normalizeCategoryValue } from "../../scripts/scripts.js";
import { dispatchCustomEvent } from "../../scripts/custom-events.js";

const AUTHOR_PRODUCTS_ENDPOINT = "https://author-p139012-e1558121.adobeaemcloud.com/graphql/execute.json/allianz/getAllianzProduct;_path=";
const PUBLISH_PRODUCTS_ENDPOINT = "https://publish-p139012-e1558121.adobeaemcloud.com/graphql/execute.json/allianz/getAllianzProduct;_path=";

function coerceConfigScalar(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return coerceConfigScalar(v[0]);
  return String(v).trim();
}

function getDefaultProductDetailPath(isAuthor) {
  const currentPath = window.location.pathname;
  const basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));
  return isAuthor ? `${basePath}/product.html` : `${basePath}/product`;
}

function normalizeRedirectUrl(url) {
  const redirectUrl = coerceConfigScalar(url);
  if (!redirectUrl) return "";
  if (/^https?:\/\//i.test(redirectUrl)) {
    try {
      const parsedUrl = new URL(redirectUrl);
      if (!parsedUrl.pathname.startsWith("/content/")) return redirectUrl;
    } catch (e) {
      return redirectUrl;
    }
  }
  return normalizeAemPath(redirectUrl);
}

function appendProductId(url, productId) {
  if (!url || !productId) return "#";
  const [baseUrl, hash] = url.split("#");
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}productId=${encodeURIComponent(productId)}${hash ? `#${hash}` : ""}`;
}

function buildProductUrl(item, isAuthor, redirectUrl = "") {
  const productId = item?.sku || "";
  if (!productId) return "#";
  return appendProductId(redirectUrl || getDefaultProductDetailPath(isAuthor), productId);
}

function buildStarRating(rating) {
  const container = document.createElement("div");
  container.className = "cpl-card-stars";
  container.setAttribute("aria-label", `Rating: ${rating} out of 5`);
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.setAttribute("aria-hidden", "true");
    if (rating >= i) {
      star.className = "cpl-card-star cpl-card-star--full";
    } else if (rating >= i - 0.5) {
      star.className = "cpl-card-star cpl-card-star--half";
    } else {
      star.className = "cpl-card-star cpl-card-star--empty";
    }
    container.append(star);
  }
  return container;
}

export function buildCard(item, isAuthor, redirectUrl = "", enableAddToCart = false, addToCartEventType = '') {
  const { sku, title, imageFile = {}, category, buyout, year, targetAudience = [], rating, price, description = {} } = item || {};
  const productId = sku || "";

  const wrapper = document.createElement("div");
  wrapper.className = "cpl-card-wrapper";

  const card = document.createElement("article");
  card.className = "cpl-card";

  if (productId) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      window.location.href = buildProductUrl(item, isAuthor, redirectUrl);
    });
  }

  // Image area
  const imgWrap = document.createElement("div");
  imgWrap.className = "cpl-card-media";

  if (imageFile && (imageFile._dynamicUrl || imageFile._publishUrl || imageFile._authorUrl)) {
    const picture = createProductImage(imageFile, title || "Product image", { isAuthor, eager: false });
    if (picture) imgWrap.append(picture);
  }

  // Content
  const meta = document.createElement("div");
  meta.className = "cpl-card-meta";

  const titleEl = document.createElement("h3");
  titleEl.className = "cpl-card-title";
  titleEl.textContent = title || "";
  meta.append(titleEl);

  if (targetAudience && targetAudience.length > 0) {
    const audienceEl = document.createElement("p");
    audienceEl.className = "cpl-card-audience";
    const label = document.createElement("strong");
    label.textContent = "Target: ";
    audienceEl.append(label, targetAudience.join(", "));
    meta.append(audienceEl);
  }

  if (year || buyout) {
    const buyoutEl = document.createElement("p");
    buyoutEl.className = "cpl-card-buyout";
    const parts = [];
    if (year) {
      const yearLabel = document.createElement("strong");
      yearLabel.textContent = "Year: ";
      parts.push(yearLabel, String(year));
    }
    if (year && buyout) parts.push(" | ");
    if (buyout) {
      const buyoutLabel = document.createElement("strong");
      buyoutLabel.textContent = "Buyout: ";
      parts.push(buyoutLabel, buyout);
    }
    buyoutEl.append(...parts);
    meta.append(buyoutEl);
  }

  // Footer: Product button + star rating
  const footer = document.createElement("div");
  footer.className = "cpl-card-footer";

  const productBtn = document.createElement("button");
  productBtn.className = "cpl-card-product-btn";
  productBtn.textContent = category ? category.charAt(0).toUpperCase() + category.slice(1) : '';
  productBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (productId) window.location.href = buildProductUrl(item, isAuthor, redirectUrl);
  });
  footer.append(productBtn);

  if (rating != null) footer.append(buildStarRating(rating));

  meta.append(footer);
  card.append(imgWrap, meta);
  wrapper.append(card);

  if (enableAddToCart && productId) {
    const formattedCategory = category ? normalizeCategoryValue(category).replace(/\//g, " / ") : "";
    const cartImageUrl = isAuthor ? imageFile?._authorUrl : imageFile?._publishUrl;
    const addToCartBtn = document.createElement("button");
    addToCartBtn.className = "cpl-card-add-to-cart";
    addToCartBtn.textContent = "Add to Cart";
    addToCartBtn.setAttribute("aria-label", `Add ${title} to cart`);
    addToCartBtn.addEventListener("click", () => {
      window.addToCart({
        id: sku || "",
        name: title || "",
        image: cartImageUrl || "",
        thumbnail: cartImageUrl || "",
        category: formattedCategory,
        description: description?.plaintext || "",
        price: price || 0,
        quantity: 1,
      });
      if (addToCartEventType) dispatchCustomEvent(addToCartEventType);
      addToCartBtn.textContent = "Added to Cart ✓";
      addToCartBtn.classList.add("cpl-card-add-to-cart--added");
      setTimeout(() => {
        addToCartBtn.textContent = "Add to Cart";
        addToCartBtn.classList.remove("cpl-card-add-to-cart--added");
      }, 2000);
    });
    wrapper.append(addToCartBtn);
  }

  return wrapper;
}

async function fetchProducts(path, isAuthor) {
  try {
    if (!path) return [];
    const url = isAuthor
      ? `${AUTHOR_PRODUCTS_ENDPOINT}${path}`
      : `${PUBLISH_PRODUCTS_ENDPOINT}${path}?ts=${Date.now()}`;
    const resp = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });
    const json = await resp.json();
    return json?.data?.allianzProductModelList?.items || [];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Category Products Lister: fetch error", e);
    return [];
  }
}

function getJcrCreated(item) {
  const meta = item?._metadata?.calendarMetadata;
  if (!Array.isArray(meta)) return null;
  const entry = meta.find((m) => m.name === "jcr:created");
  return entry?.value ? new Date(entry.value).getTime() : null;
}

function sortByJcrCreated(items) {
  return [...items].sort((a, b) => {
    const ta = getJcrCreated(a);
    const tb = getJcrCreated(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta; // newest first
  });
}

function filterByCategories(items, tags) {
  if (!tags) return items;
  const filterList = (Array.isArray(tags) ? tags : `${tags}`.split(','))
    .map((t) => normalizeCategoryValue(`${t}`.trim()).toLowerCase())
    .filter(Boolean);
  if (!filterList.length) return items;
  return items.filter((item) => {
    if (!item.category) return false;
    const normalized = normalizeCategoryValue(item.category).toLowerCase();
    return filterList.some((tag) => normalized.includes(tag) || tag.includes(normalized));
  });
}

function readCardsPerRow(cfg, block) {
  const raw = coerceConfigScalar(cfg?.["cards-per-row"]);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(6, Math.max(1, n));
}

function renderHeader(container, selectedTags) {
  if (!selectedTags || selectedTags.length === 0) return;
  const wrap = document.createElement("div");
  wrap.className = "cpl-tags";
  const list = Array.isArray(selectedTags)
    ? selectedTags
    : `${selectedTags}`.split(",");
  list
    .map((t) => `${t}`.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "cpl-tag";
      chip.textContent = tag;
      wrap.append(chip);
    });
  container.append(wrap);
}

function renderCarousel(block, items, cfg, isAuthor, redirectUrl = "") {
  const heading = coerceConfigScalar(cfg?.["heading"] || cfg?.["block-title"]);
  const learnMoreLabel = coerceConfigScalar(cfg?.["learn-more-label"]) || "Learn more";

  const carousel = document.createElement("div");
  carousel.className = "cpl-carousel";

  if (heading) {
    const hdr = document.createElement("div");
    hdr.className = "cpl-carousel-header";
    const h2 = document.createElement("h2");
    h2.textContent = heading;
    hdr.append(h2);
    carousel.append(hdr);
  }

  const stage = document.createElement("div");
  stage.className = "cpl-carousel-stage";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "cpl-carousel-btn cpl-carousel-btn--prev";
  prevBtn.setAttribute("aria-label", "Previous");
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "cpl-carousel-btn cpl-carousel-btn--next";
  nextBtn.setAttribute("aria-label", "Next");

  const track = document.createElement("div");
  track.className = "cpl-carousel-track";

  items.forEach((item, i) => {
    const { imageFile = {} } = item || {};
    const slide = document.createElement("div");
    slide.className = "cpl-carousel-slide";
    if (i === 0) slide.classList.add("active");

    if (imageFile && (imageFile._publishUrl || imageFile._authorUrl || imageFile._dynamicUrl)) {
      const picture = createProductImage(imageFile, item.title || "Product image", {
        isAuthor,
        eager: i === 0,
      });
      slide.append(picture);
    }
    track.append(slide);
  });

  stage.append(prevBtn, track, nextBtn);
  carousel.append(stage);

  const meta = document.createElement("div");
  meta.className = "cpl-carousel-meta";

  const nameEl = document.createElement("h3");
  nameEl.className = "cpl-carousel-name";
  nameEl.textContent = items[0]?.title || "";

  const learnMoreBtn = document.createElement("a");
  learnMoreBtn.className = "cpl-carousel-learn-more button";
  learnMoreBtn.textContent = learnMoreLabel;

  learnMoreBtn.href = buildProductUrl(items[0], isAuthor, redirectUrl);

  meta.append(nameEl, learnMoreBtn);
  carousel.append(meta);

  block.append(carousel);

  let current = 0;

  function goTo(index) {
    const slides = track.querySelectorAll(".cpl-carousel-slide");
    slides[current].classList.remove("active");
    current = (index + items.length) % items.length;
    slides[current].classList.add("active");
    nameEl.textContent = items[current]?.title || "";
    learnMoreBtn.href = buildProductUrl(items[current], isAuthor, redirectUrl);
  }

  prevBtn.addEventListener("click", () => goTo(current - 1));
  nextBtn.addEventListener("click", () => goTo(current + 1));
}

export default async function decorate(block) {
  // Check if we're in author environment
  const isAuthor = isAuthorEnvironment();
  const cfg = readBlockConfig(block) || {};

  const rawRedirectUrl = cfg?.["redirect-url"] || cfg?.redirecturl || cfg?.redirectUrl;
  const redirectUrl = normalizeRedirectUrl(rawRedirectUrl);

  // Prefer the authored folder field; fall back to legacy link-only markup.
  let folderHref = cfg?.folder
    || cfg?.reference
    || cfg?.path
    || "";

  if (!folderHref && !rawRedirectUrl) {
    folderHref = block.querySelector("a[href]")?.href
      || block.querySelector("a[href]")?.textContent?.trim()
      || "";
  }

  const styleVariant = coerceConfigScalar(cfg?.style);
  if (styleVariant) block.classList.add(styleVariant);

  const noBackground = coerceConfigScalar(cfg?.["no-background"]);
  if (noBackground === "true") block.classList.add("no-background");

  // Normalize folder path to pathname if an absolute URL is provided
  try {
    if (folderHref && folderHref.startsWith("http")) {
      const u = new URL(folderHref);
      folderHref = u.pathname;
    }
  } catch (e) {
    /* ignore */
  }

  // Remove .html extension if present (Universal Editor adds it)
  if (folderHref && folderHref.endsWith(".html")) {
    folderHref = folderHref.replace(/\.html$/, "");
  }

  // Extract tags - for Universal Editor they'll be in data attributes
  const tags = block.dataset?.["cqTags"]
    || cfg?.tags
    || cfg?.["cq-tags"]
    || cfg?.["cq:tags"]
    || "";

  const cardsPerRow = readCardsPerRow(cfg, block);

  const enableAddToCart = (() => {
    const raw = coerceConfigScalar(cfg?.["enableaddtocartattileview"]);
    return raw.toLowerCase() === "true";
  })();

  const addToCartEventType = enableAddToCart ? (coerceConfigScalar(cfg?.["addtocarteventtype"])) : '';

  // Clear author table
  block.innerHTML = "";

  const allItems = await fetchProducts(folderHref, isAuthor);
  const items = sortByJcrCreated(filterByCategories(allItems, tags));

  if (styleVariant === "carousel") {
    if (!items || items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "cpl-empty";
      empty.textContent = "No products found.";
      block.append(empty);
      return;
    }
    renderCarousel(block, items, cfg, isAuthor, redirectUrl);
    return;
  }

  renderHeader(block, tags);

  const grid = document.createElement("div");
  grid.className = "cpl-grid";
  grid.style.setProperty(
    "--cpl-card-width",
    `calc((100% - ${cardsPerRow - 1} * var(--cpl-gap)) / ${cardsPerRow})`,
  );
  block.append(grid);

  if (!items || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cpl-empty";
    empty.textContent = "No products found.";
    grid.append(empty);
    return;
  }

  const cards = items.map((item) => (
    buildCard(item, isAuthor, redirectUrl, enableAddToCart, addToCartEventType)
  ));
  grid.append(...cards);
}

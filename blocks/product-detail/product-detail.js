import { createProductImage, readBlockConfig, loadCSS } from "../../scripts/aem.js";
import { isAuthorEnvironment, normalizeCategoryValue } from "../../scripts/scripts.js";
import { dispatchCustomEvent } from "../../scripts/custom-events.js";
import { buildCard } from "../category-products-lister/category-products-lister.js";

const AUTHOR_PRODUCT_DETAIL_ENDPOINT = "https://author-p139012-e1558121.adobeaemcloud.com/graphql/execute.json/allianz/getAllianzProductDetails;";
const PUBLISH_PRODUCT_DETAIL_ENDPOINT = "https://publish-p139012-e1558121.adobeaemcloud.com/graphql/execute.json/allianz/getAllianzProductDetails;";
const AUTHOR_PRODUCTS_ENDPOINT = "https://author-p139012-e1558121.adobeaemcloud.com/graphql/execute.json/allianz/getAllianzProduct;_path=";
const PUBLISH_PRODUCTS_ENDPOINT = "https://publish-p139012-e1558121.adobeaemcloud.com/graphql/execute.json/allianz/getAllianzProduct;_path=";

const STATIC_DETAILS = [
  {
    label: "Business objectives",
    separator: " – ",
    text: "Providing context for the marketing activity through indicating the challenges that were addressed or the main objectives",
  },
  {
    label: "Activity summary",
    separator: ": ",
    text: "Overview of involved channels and available asset formats (static, motion picture, audio), CTA, timings, lessons learned or other insights valuable to share incl. key visuals",
  },
  {
    label: "KPIs",
    separator: ": ",
    text: "Based on comparable KPIs e.g., view-through-rate, click-rate, conversion rate or digital NPS uplift",
  },
  {
    label: "Agency",
    separator: ": ",
    text: "Agency name, potentially contact at agency",
  },
];

const COUNTRY_FLAGS = {
  // Central / Western Europe
  de: "🇩🇪", germany: "🇩🇪", deutschland: "🇩🇪",
  fr: "🇫🇷", france: "🇫🇷",
  gb: "🇬🇧", uk: "🇬🇧", "united kingdom": "🇬🇧",
  it: "🇮🇹", italy: "🇮🇹",
  es: "🇪🇸", spain: "🇪🇸",
  nl: "🇳🇱", netherlands: "🇳🇱",
  ch: "🇨🇭", switzerland: "🇨🇭",
  at: "🇦🇹", austria: "🇦🇹",
  be: "🇧🇪", belgium: "🇧🇪",
  pt: "🇵🇹", portugal: "🇵🇹",
  // Eastern Europe
  pl: "🇵🇱", poland: "🇵🇱",
  sk: "🇸🇰", slovakia: "🇸🇰",
  cz: "🇨🇿", "czech republic": "🇨🇿", czechia: "🇨🇿",
  hu: "🇭🇺", hungary: "🇭🇺",
  ro: "🇷🇴", romania: "🇷🇴",
  bg: "🇧🇬", bulgaria: "🇧🇬",
  hr: "🇭🇷", croatia: "🇭🇷",
  // Americas
  us: "🇺🇸", usa: "🇺🇸", "united states": "🇺🇸",
  br: "🇧🇷", brazil: "🇧🇷",
  mx: "🇲🇽", mexico: "🇲🇽",
  // Asia-Pacific
  cn: "🇨🇳", china: "🇨🇳",
  jp: "🇯🇵", japan: "🇯🇵",
  in: "🇮🇳", india: "🇮🇳",
  id: "🇮🇩", indonesia: "🇮🇩",
  au: "🇦🇺", australia: "🇦🇺",
  sg: "🇸🇬", singapore: "🇸🇬",
  // Middle East / Africa
  ae: "🇦🇪", uae: "🇦🇪", "united arab emirates": "🇦🇪",
  za: "🇿🇦", "south africa": "🇿🇦",
  // Nordic
  se: "🇸🇪", sweden: "🇸🇪",
  dk: "🇩🇰", denmark: "🇩🇰",
  no: "🇳🇴", norway: "🇳🇴",
  fi: "🇫🇮", finland: "🇫🇮",
  // Special
  global: "🌍",
};

function cleanCountryName(raw) {
  // Strip surrounding escaped/literal quotes that the CMS injects: "\"Slovakia\"" → "Slovakia"
  return (raw || "").replace(/^["']+|["']+$/g, "").trim();
}

function getCountryFlag(raw) {
  const name = cleanCountryName(raw);
  return name ? (COUNTRY_FLAGS[name.toLowerCase()] || "") : "";
}

function getQueryParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

function updatePageTitle(product) {
  const t = (product?.title || "").trim();
  if (t) document.title = t;
}

async function fetchProductDetail(path, sku, isAuthor) {
  try {
    if (!path || !sku) {
      // eslint-disable-next-line no-console
      console.error("Product Detail: Missing path or SKU");
      return null;
    }
    const base = isAuthor ? AUTHOR_PRODUCT_DETAIL_ENDPOINT : PUBLISH_PRODUCT_DETAIL_ENDPOINT;
    const resp = await fetch(`${base}_path=${path};sku=${sku}`, {
      method: "GET",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
    });
    const json = await resp.json();
    const items = json?.data?.allianzProductModelList?.items || [];
    return items.length > 0 ? items[0] : null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Product Detail: fetch error", e);
    return null;
  }
}

async function fetchAllProducts(path, isAuthor) {
  try {
    if (!path) return [];
    const url = isAuthor
      ? `${AUTHOR_PRODUCTS_ENDPOINT}${path}`
      : `${PUBLISH_PRODUCTS_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
    });
    const json = await resp.json();
    return (json?.data?.allianzProductModelList?.items || []).filter((item) => item?.sku);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Product Detail: fetch all products error", e);
    return [];
  }
}


function buildProductDetail(product, isAuthor, eventConfig = {}) {
  const {
    title = "",
    buyout = "",
    category = "",
    description = {},
    imageFile = {},
    sku = "",
    targetAudience = [],
    year,
    country = [],
    product: productType = "",
  } = product;

  const imageUrl = isAuthor ? imageFile?._authorUrl : imageFile?._publishUrl;
  if (typeof window.updateDataLayer === "function") {
    window.updateDataLayer({
      product: {
        id: sku, sku, name: title, price: buyout,
        category: category ? normalizeCategoryValue(category).replace(/\//g, " / ") : "",
        description: description?.plaintext || description?.html || description?.markdown || "",
        image: imageUrl || "", thumbnail: imageUrl || "",
      },
    });
  }

  const container = document.createElement("div");
  container.className = "pd-container";

  // ── Left: Image ──────────────────────────────────────────────────────────
  const imageSection = document.createElement("div");
  imageSection.className = "pd-image";
  if (imageFile && (imageFile._dynamicUrl || imageFile._publishUrl || imageFile._authorUrl)) {
    const picture = createProductImage(imageFile, title || "Product image", { isAuthor, eager: true });
    if (picture) imageSection.appendChild(picture);
  }

  // ── Right: Content panel ─────────────────────────────────────────────────
  const contentSection = document.createElement("div");
  contentSection.className = "pd-content";

  // Metadata bar: Origin OE | Content type
  const metaItems = [];

  if (country && country.length > 0) {
    const cleaned = cleanCountryName(country[0]);
    const flag = getCountryFlag(country[0]);
    metaItems.push({ label: "Origin OE", display: flag || cleaned, isFlag: !!flag });
  }

  if (category) {
    metaItems.push({ label: "Content type", display: normalizeCategoryValue(category).replace(/\//g, " / ") });
  }

  if (productType) {
    metaItems.push({ label: "Product", display: productType });
  }

  if (metaItems.length > 0) {
    const metaBar = document.createElement("div");
    metaBar.className = "pd-meta-bar";

    metaItems.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "pd-meta-item";

      const labelEl = document.createElement("span");
      labelEl.className = "pd-meta-label";
      labelEl.textContent = item.label;

      const valueEl = document.createElement("span");
      valueEl.className = item.isFlag ? "pd-meta-flag" : "pd-meta-value";
      valueEl.textContent = item.display;

      el.append(labelEl, valueEl);
      metaBar.append(el);

      if (i < metaItems.length - 1) {
        const divider = document.createElement("div");
        divider.className = "pd-meta-divider";
        metaBar.append(divider);
      }
    });

    contentSection.appendChild(metaBar);
  }

  // Campaign Name label
  const campaignLabel = document.createElement("p");
  campaignLabel.className = "pd-campaign-label";
  campaignLabel.textContent = "Campaign Name";
  contentSection.appendChild(campaignLabel);

  // Title
  const nameEl = document.createElement("h1");
  nameEl.className = "pd-name";
  nameEl.textContent = title;
  contentSection.appendChild(nameEl);

  // Description
  const descText = description?.plaintext || description?.html || description?.markdown || "";
  if (descText) {
    if (description?.html) {
      const descEl = document.createElement("div");
      descEl.className = "pd-description";
      descEl.innerHTML = description.html;
      contentSection.appendChild(descEl);
    } else {
      const descEl = document.createElement("p");
      descEl.className = "pd-description";
      descEl.textContent = descText;
      contentSection.appendChild(descEl);
    }
  }

  // Details list
  const detailsList = document.createElement("ul");
  detailsList.className = "pd-details-list";

  if (year) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = "Year: ";
    li.append(strong, String(year));
    detailsList.append(li);
  }

  if (targetAudience && targetAudience.length > 0) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = "Target audience: ";
    li.append(strong, targetAudience.join(", "));
    detailsList.append(li);
  }

  STATIC_DETAILS.forEach(({ label, separator, text }) => {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = label;
    li.append(strong, separator, text);
    detailsList.append(li);
  });

  contentSection.appendChild(detailsList);

  // Buyout costs pricing box
  if (buyout) {
    const pricingSection = document.createElement("div");
    pricingSection.className = "pd-pricing";

    const box = document.createElement("div");
    box.className = "pd-pricing-box";

    const boxTitle = document.createElement("span");
    boxTitle.className = "pd-pricing-box-title";
    boxTitle.textContent = "Buyout costs";

    const boxSub = document.createElement("span");
    boxSub.className = "pd-pricing-box-sub";
    boxSub.textContent = "1 year / digital channels";

    const boxValue = document.createElement("div");
    boxValue.className = "pd-pricing-box-value";
    const fromSpan = document.createElement("span");
    fromSpan.className = "pd-pricing-from";
    fromSpan.textContent = "from ";
    const priceSpan = document.createElement("span");
    priceSpan.className = "pd-pricing-price";
    priceSpan.textContent = buyout;
    boxValue.append(fromSpan, priceSpan);

    box.append(boxTitle, boxSub, boxValue);
    pricingSection.appendChild(box);
    contentSection.appendChild(pricingSection);
  }

  // Rights available until (derived from year)
  if (year) {
    const rightsEl = document.createElement("div");
    rightsEl.className = "pd-rights";

    const rightsLabel = document.createElement("p");
    rightsLabel.className = "pd-rights-label";
    rightsLabel.textContent = "Rights available until";

    const rightsValue = document.createElement("p");
    rightsValue.className = "pd-rights-value";
    rightsValue.textContent = `12/${year + 3}`;

    rightsEl.append(rightsLabel, rightsValue);
    contentSection.appendChild(rightsEl);
  }

  // Action buttons
  const actionsEl = document.createElement("div");
  actionsEl.className = "pd-actions";

  if (eventConfig.showAddToCartButton !== false) {
    const addToCartBtn = document.createElement("button");
    addToCartBtn.className = "pd-btn pd-btn-primary";
    addToCartBtn.textContent = "Add to cart";
    addToCartBtn.setAttribute("aria-label", `Add ${title} to cart`);
    addToCartBtn.addEventListener("click", () => {
      const cartImageUrl = isAuthor ? imageFile?._authorUrl : imageFile?._publishUrl;
      window.addToCart({
        id: sku, name: title,
        image: cartImageUrl || "", thumbnail: cartImageUrl || "",
        category: category ? normalizeCategoryValue(category).replace(/\//g, " / ") : "",
        description: description?.plaintext || description?.html || description?.markdown || "",
        price: buyout || 0, quantity: 1,
      });
      if (eventConfig.addToCart) dispatchCustomEvent(eventConfig.addToCart);
      addToCartBtn.textContent = "Added to cart ✓";
      setTimeout(() => { addToCartBtn.textContent = "Add to cart"; }, 2000);
    });
    actionsEl.append(addToCartBtn);
  }

  if (eventConfig.showAddToWishlistButton) {
    const wishlistBtn = document.createElement("button");
    wishlistBtn.className = "pd-btn pd-btn-icon";
    wishlistBtn.setAttribute("aria-label", `Add ${title} to wishlist`);
    // eslint-disable-next-line no-unsanitized/property
    wishlistBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    wishlistBtn.addEventListener("click", () => {
      if (eventConfig.addToWishlist) dispatchCustomEvent(eventConfig.addToWishlist);
    });
    actionsEl.append(wishlistBtn);
  }

  contentSection.appendChild(actionsEl);
  container.append(imageSection, contentSection);
  return container;
}

function buildRecommendations(currentProduct, allProducts, isAuthor) {
  const { sku: currentSku, category: currentCategory } = currentProduct;
  if (!currentCategory) return null;

  const recommendations = allProducts
    .filter((p) => p.sku !== currentSku && p.category === currentCategory)
    .slice(0, 5);

  if (!recommendations.length) return null;

  const section = document.createElement("div");
  section.className = "pd-recommendations";

  const titleEl = document.createElement("h2");
  titleEl.className = "pd-rec-title";
  titleEl.textContent = "YOU MAY ALSO LIKE";

  const grid = document.createElement("div");
  grid.className = "cpl-grid";
  grid.style.setProperty("--cpl-gap", "24px");
  grid.style.setProperty("--cpl-card-width", "calc((100% - 3 * 24px) / 4)");
  recommendations.forEach((p) => grid.append(buildCard(p, isAuthor)));

  section.append(titleEl, grid);
  return section;
}

export default async function decorate(block) {
  const isTruthy = (v) => v === true || String(v || '').trim().toLowerCase() === 'true';
  const isAuthor = isAuthorEnvironment();
  const config = readBlockConfig(block);

  // Load cpl CSS so the reused cpl-card classes are styled correctly
  loadCSS(`${window.hlx?.codeBasePath || ''}/blocks/category-products-lister/category-products-lister.css`);

  const eventConfig = {
    productView: (config.productvieweventtype || config['product-view-event-type'] || '').trim(),
    addToCart: (config.addtocarteventtype || config['add-to-cart-event-type'] || '').trim(),
    addToWishlist: (config.addtowishlisteventtype || config['add-to-wishlist-event-type'] || '').trim(),
    showAddToCartButton: config.showaddtocartbutton === undefined && config['show-add-to-cart-button'] === undefined
      ? true : isTruthy(config.showaddtocartbutton ?? config['show-add-to-cart-button']),
    showAddToWishlistButton: config.showaddtowishlistbutton === undefined && config['show-add-to-wishlist-button'] === undefined
      ? true : isTruthy(config.showaddtowishlistbutton ?? config['show-add-to-wishlist-button']),
    showYouMayAlsoLikeSection: config.showyoumayalsolikesection === undefined && config['show-you-may-also-like-section'] === undefined
      ? true : isTruthy(config.showyoumayalsolikesection ?? config['show-you-may-also-like-section']),
  };

  let folderHref = block.querySelector("a[href]")?.getAttribute("href") || config.folder || "";

  if (folderHref?.startsWith("http")) {
    try { folderHref = new URL(folderHref).pathname; } catch (e) { /* ignore */ }
  }
  if (folderHref?.endsWith(".html")) folderHref = folderHref.replace(/\.html$/, "");

  const sku = getQueryParam("productId");
  block.textContent = "";

  if (!folderHref) {
    const err = document.createElement("p");
    err.className = "pd-error";
    err.textContent = "Please configure the product folder path in the properties panel.";
    block.appendChild(err);
    return;
  }

  if (!sku) {
    const err = document.createElement("p");
    err.className = "pd-error";
    err.textContent = "Product not found. Missing product ID in URL.";
    block.appendChild(err);
    return;
  }

  const loader = document.createElement("p");
  loader.className = "pd-loading";
  loader.textContent = "Loading product details...";
  block.appendChild(loader);

  const [product, allProducts] = await Promise.all([
    fetchProductDetail(folderHref, sku, isAuthor),
    eventConfig.showYouMayAlsoLikeSection ? fetchAllProducts(folderHref, isAuthor) : Promise.resolve([]),
  ]);

  block.textContent = "";

  if (!product) {
    const err = document.createElement("p");
    err.className = "pd-error";
    err.textContent = "Product not found or failed to load.";
    block.appendChild(err);
    return;
  }

  updatePageTitle(product);
  block.appendChild(buildProductDetail(product, isAuthor, eventConfig));

  if (eventConfig.showYouMayAlsoLikeSection) {
    const recs = buildRecommendations(product, allProducts, isAuthor);
    if (recs) block.appendChild(recs);
  }

  if (eventConfig.productView) dispatchCustomEvent(eventConfig.productView);
}

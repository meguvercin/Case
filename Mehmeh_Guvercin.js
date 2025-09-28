class EbebekReel {
  constructor() {
    this.api = "https://gist.githubusercontent.com/sevindi/8bcbde9f02c1d4abe112809c974e1f49/raw/9bf93b58df623a9b16f1db721cd0a7a539296cf0/products.json";
    this.keys = {
      products: "eb_reel_cached_products",
      wishlist: "eb_reel_user_wishlist",
      ratings: "eb_reel_user_ratings"
    };
    this.products = [];
    this.wishlist = new Set();
    this.ratings = {};
    this.container = null;
    this.track = null;
  }

  async init() {
    if (window.location.origin !== "https://www.e-bebek.com" || window.location.pathname !== "/") {
      console.log("wrong page");
      return;
    }
    this.wishlist = new Set(this.storageGet(this.keys.wishlist, []));
    this.ratings = this.storageGet(this.keys.ratings, {});
    this.renderLayout();
    this.applyStyles();
    this.bindEvents();
    const productData = await this.fetchProducts();
    if (productData.length > 0) {
      this.products = productData;
      this.renderProducts();
    }
  }

  async fetchProducts() {
    const cached = this.storageGet(this.keys.products);
    if (cached) return cached;
    try {
      const res = await fetch(this.api);
      const data = await res.json();
      this.storageSet(this.keys.products, data);
      return data;
    } catch {
      return [];
    }
  }

  renderLayout() {
    const html = `
      <section class="eb-reel">
        <h2 class="reel-title">Beğenebileceğinizi düşündüklerimiz</h2>
        <div class="reel-wrapper">
          <button class="reel-nav prev" data-dir="-1" aria-label="Önceki"></button>
          <div class="reel-track"></div>
          <button class="reel-nav next" data-dir="1" aria-label="Sonraki"></button>
        </div>
      </section>
    `;
    const target = document.querySelector(".Section2A") || document.body;
    target.insertAdjacentHTML(target === document.body ? "beforeend" : "beforebegin", html);
    this.container = document.querySelector(".eb-reel");
    this.track = this.container.querySelector(".reel-track");
  }

  renderProducts() {
    const productHTML = this.products.map(p => this.getProductCardHTML(p)).join("");
    this.track.innerHTML = productHTML;
    this.updateRatingsUI();
  }

  getProductCardHTML(product) {
    const { id, url, img, name, brand, price, original_price } = product;
    const priceNum = Number(price);
    const originalNum = Number(original_price);
    let priceHTML = `<div class="price-standard">${this.formatPrice(priceNum)}</div>`;
    if (!isNaN(priceNum) && !isNaN(originalNum) && priceNum < originalNum) {
      const discountPercent = Math.round(100 - (priceNum * 100) / originalNum);
      priceHTML = `
        <div class="price-discounted">
          <div class="price-top-row">
            <span class="price-old">${String(original_price).replace(".", ",")} TL</span>
            <span class="discount-badge">%${discountPercent}</span>
          </div>
          <span class="price-new">${this.formatPrice(priceNum)}</span>
        </div>`;
    }
    return `
      <article class="product-tile" data-id="${id}">
        <a class="tile-link" href="${url || "#"}" target="_blank" rel="noopener">
          <figure class="tile-image-wrapper">
            <img class="tile-image" src="${img || ""}" alt="${name || ""}" loading="lazy" />
          </figure>
          <div class="tile-content">
            <h3 class="tile-title"><strong>${brand || ""}</strong> - ${name || ""}</h3>
            <div class="rating-display">
              <div class="stars-wrapper" data-id="${id}">
                ${[1,2,3,4,5].map(i => `<i class="star" data-value="${i}"></i>`).join("")}
              </div>
              <span class="rating-count">(0)</span>
            </div>
            <div class="tile-price">${priceHTML}</div>
          </div>
        </a>
        <div class="wishlist-toggle ${this.wishlist.has(String(id)) ? "active" : ""}" data-id="${id}">
          <i class="heart-icon"></i>
        </div>
        <button type="button" class="btn btn-add btn-add-circle">
          <div class="inner-btn">
            <i class="toys-icon toys-icon-plus-blue add-icon"></i>
            <i class="toys-icon toys-icon-plus-white add-icon hovered"></i>
          </div>
        </button>
      </article>`;
  }

  bindEvents() {
    this.container.addEventListener("click", e => {
      const wishlistBtn = e.target.closest(".wishlist-toggle");
      const star = e.target.closest(".star");
      const navBtn = e.target.closest(".reel-nav");
      if (wishlistBtn) this.toggleWishlist(wishlistBtn);
      else if (star) this.handleRating(star);
      else if (navBtn) this.scrollCarousel(navBtn.dataset.dir);
    });
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.snapCarousel(), 150);
    });
  }

  toggleWishlist(btn) {
    const id = btn.dataset.id || btn.closest(".product-tile").dataset.id;
    btn.classList.toggle("active");
    if (this.wishlist.has(id)) this.wishlist.delete(id);
    else this.wishlist.add(id);
    this.storageSet(this.keys.wishlist, [...this.wishlist]);
  }

  handleRating(star) {
    const id = star.closest(".product-tile").dataset.id;
    const value = Number(star.dataset.value);
    this.ratings[id] = value;
    this.storageSet(this.keys.ratings, this.ratings);
    this.updateRatingsUI(star.closest(".product-tile"));
  }

  updateRatingsUI(scope = document) {
    for (const id in this.ratings) {
      const tile = scope.querySelector(`.product-tile[data-id="${id}"]`);
      if (tile) tile.querySelectorAll(".star").forEach(s => {
        s.classList.toggle("filled", Number(s.dataset.value) <= this.ratings[id]);
      });
    }
  }

  scrollCarousel(direction) {
    const step = this.getScrollStep();
    this.track.scrollBy({ left: step * Number(direction), behavior: "smooth" });
  }

  snapCarousel() {
    const step = this.getScrollStep();
    if (!step) return;
    this.track.scrollTo({ left: Math.round(this.track.scrollLeft / step) * step, behavior: "auto" });
  }

  getScrollStep() {
    const firstItem = this.track.firstElementChild;
    return firstItem ? firstItem.offsetWidth + parseInt(getComputedStyle(this.track).gap || "0", 10) : 0;
  }

  formatPrice(num) {
    if (isNaN(num)) return "";
    const s = num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const [intPart = "", decPart = "00"] = s.split(",");
    return `<span class="reel-price-int">${intPart}</span><span class="reel-price-dec">,${decPart} TL</span>`;
  }

  storageGet(key, fallback = null) {
    const item = localStorage.getItem(key);
    try { return item ? JSON.parse(item) : fallback; } catch { return fallback; }
  }

  storageSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  applyStyles() {
    if (document.getElementById("eb-reel-styles")) return;
    const style = document.createElement("style");
    style.id = "eb-reel-styles";
    style.textContent = `
      .eb-reel{--reel-cols:5;--reel-gap:16px;max-width:100%;width:100%;padding:50px 15px;margin:auto}
      .reel-title{margin:0 0 16px;font-size:24px;font-weight:500;color:#2b2f33;font-family:Quicksand-SemiBold}
      .reel-wrapper{position:relative}
      .reel-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:10;width:36px;height:36px;border-radius:50%;border:none;background:#fff;box-shadow:0 2px 9px rgba(0,0,0,.08),0 0 1px rgba(0,0,0,.28);cursor:pointer;display:flex;align-items:center;justify-content:center}
      .reel-nav::before{content:"";display:block;width:14px;height:14px;background-color:#333;-webkit-mask-image:url("https://cdn06.e-bebek.com/assets/toys/svg/arrow-right.svg");mask-image:url("https://cdn06.e-bebek.com/assets/toys/svg/arrow-right.svg");-webkit-mask-size:contain;mask-size:contain}
      .reel-nav.prev::before{transform:rotate(180deg)}
      .reel-nav.prev{left:-65px}
      .reel-nav.next{right:-65px}
      .reel-track{display:flex;gap:var(--reel-gap);overflow-x:auto;padding:4px 2px 10px;scroll-snap-type:x mandatory;scrollbar-width:none;align-items:stretch}
      .reel-track::-webkit-scrollbar{display:none}
      .product-tile{flex:0 0 calc((100% - (var(--reel-cols) - 1)*var(--reel-gap))/var(--reel-cols));border:1px solid #f2f5f7;border-radius:8px;background:#fff;position:relative;transition:all .2s ease;scroll-snap-align:start}
      .product-tile:hover{box-shadow:0 2px 6px rgba(0,0,0,.05);border-color:#d0d7de}
      .tile-link{display:flex;flex-direction:column;color:inherit;text-decoration:none;height:100%}
      .tile-image-wrapper{height:240px;padding:12px;display:flex;align-items:flex-end;justify-content:center}
      .tile-image{max-width:100%;max-height:100%;object-fit:contain}
      .tile-content{display:flex;flex-direction:column;flex-grow:1;padding:8px 10px 14px}
      .tile-title{font-size:12px;color:#2b2f33;margin:0 0 10px;line-height:1.4;min-height:34px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
      .tile-price{margin-top:auto;padding-top:40px;font-family:Quicksand-SemiBold;line-height:20px}
      .price-standard{font-size:20px;color:#2b2f33}
      .price-top-row{display:flex;align-items:center;gap:8px;margin-bottom:2px}
      .price-discounted{display:flex;flex-direction:column}
      .price-old{color:#a2b1bc;font-size:12px}
      .price-new{color:#00a365;font-size:20px}
      .discount-badge{font-size:12px;color:#fff;background:#00a365;border-radius:16px;padding:0 6px;line-height:20px}
      .reel-price-int{font-size:20px;line-height:1}
      .reel-price-dec{font-size:14px;line-height:1}
      .wishlist-toggle{position:absolute;top:10px;right:10px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center}
      .heart-icon{display:block;width:15px;height:15px;background:url(/assets/toys/svg/heart-outline.svg) no-repeat center/contain}
      .wishlist-toggle:not(.active):hover .heart-icon{background:url(https://cdn06.e-bebek.com/assets/toys/svg/heart-orange-outline.svg) no-repeat center/contain}
      .wishlist-toggle.active .heart-icon{background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff8a00' stroke='%23ff8a00' stroke-width='1'><path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z'/></svg>")}
      .rating-display{display:flex;align-items:center;gap:4px;margin-bottom:8px;color:#a2b1bc;font-size:12px}
      .stars-wrapper{color:#ffe8cc}
      .stars-wrapper .star::before{content:"★";font-size:11px}
      .stars-wrapper .star.filled{color:#ff8a00}
      .product-tile .btn.btn-add.btn-add-circle{position:absolute;right:12px;bottom:12px}
      @media (max-width:1479.98px){.eb-reel{--reel-cols:4}}
      @media (max-width:1279.98px){.eb-reel{--reel-cols:3}}
      @media (max-width:991.98px){.eb-reel{--reel-cols:2}}
      @media (max-width:575.98px){.eb-reel{--reel-gap:12px}.tile-image-wrapper{height:200px}}
      @media (max-width:420px){.reel-title{font-size:20px}}
    `;
    document.head.append(style);
  }
}
new EbebekReel().init();

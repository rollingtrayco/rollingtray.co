document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    //   SHARED LOGIC FOR THE ENTIRE WEBSITE
    // =================================================================

    // --- Shopify Configuration ---
    const shopifyConfig = {
        domain: 'connoissurcustoms.myshopify.com',
        storefrontAccessToken: '75774095f9799705fcc69b5a3d6b29a3',
    };

    // --- Shopify API Fetch Function ---
    async function shopifyFetch({ query, variables }) {
        try {
            const response = await fetch(`https://${shopifyConfig.domain}/api/2024-04/graphql.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Storefront-Access-Token': shopifyConfig.storefrontAccessToken,
                },
                body: JSON.stringify({ query, variables }),
            });
            return response.json();
        } catch (error) {
            console.error("Error fetching from Shopify:", error);
            return { errors: [{ message: "Network error. Please check your connection." }] };
        }
    }

    // --- Scroll Animation Observer ---
    function observeScrollAnimations() {
        const scrollElements = document.querySelectorAll('.scroll-animate:not(.visible)');
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        scrollElements.forEach(el => observer.observe(el));
    }
    observeScrollAnimations();


    // =================================================================
    //   HOME PAGE SPECIFIC LOGIC
    // =================================================================
    
    // --- Element selectors for the homepage ---
    const productGrid = document.getElementById('product-grid');
    const cartButton = document.getElementById('cart-button');
    const closeCartButton = document.getElementById('close-cart-btn');
    const cartPanel = document.getElementById('cart-panel');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartCount = document.getElementById('cart-count');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const checkoutBtn = document.getElementById('checkout-btn');
    const productModal = document.getElementById('product-modal');
    const heroHeading = document.getElementById('hero-heading');
    const canvas = document.getElementById('particle-canvas');
    const faqItems = document.querySelectorAll('.faq-item');

    // --- Run homepage logic only if the product grid exists on the page ---
    if (productGrid) {
        let cartId = localStorage.getItem('shopifyCartId');
        let checkoutUrl = '';

        // Product Modal Elements
        const closeModalBtn = document.getElementById('close-modal-btn');
        const modalMainImage = document.getElementById('modal-main-image');
        const modalThumbnails = document.getElementById('modal-thumbnails');
        const modalTitle = document.getElementById('modal-title');
        const modalPrice = document.getElementById('modal-price');
        const modalDescription = document.getElementById('modal-description');
        const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');

        // --- Fetch and Display Products ---
        async function fetchProducts() {
            const productsQuery = `
                query getProducts {
                  products(first: 9) {
                    edges {
                      node {
                        id, title, handle, descriptionHtml,
                        priceRange { minVariantPrice { amount, currencyCode } },
                        images(first: 5) { edges { node { url, altText } } },
                        variants(first: 1) { edges { node { id, availableForSale, quantityAvailable } } }
                      }
                    }
                  }
                }
            `;
            const { data, errors } = await shopifyFetch({ query: productsQuery });
            if (errors) {
                console.error("Error fetching products:", errors);
                productGrid.innerHTML = '<div class="text-center col-span-full text-red-400">Could not load products.</div>';
                return;
            }
            if (data && data.products) {
                renderProducts(data.products.edges);
            } else {
                productGrid.innerHTML = '<div class="text-center col-span-full">No products found.</div>';
            }
        }

        function renderProducts(products) {
            productGrid.innerHTML = '';
            products.forEach(({ node: product }) => {
                if (!product?.variants?.edges?.length) return;
                const variant = product.variants.edges[0].node;
                const inStock = variant?.availableForSale;
                const price = product.priceRange?.minVariantPrice?.amount;
                const images = product.images.edges.map(edge => ({ url: edge.node.url, alt: edge.node.altText }));
                const productCard = document.createElement('div');
                productCard.className = 'bg-[#111] rounded-xl overflow-hidden scroll-animate product-card';
                productCard.dataset.title = product.title;
                productCard.dataset.price = price;
                productCard.dataset.description = product.descriptionHtml;
                productCard.dataset.images = JSON.stringify(images);
                productCard.dataset.variantId = variant.id;
                productCard.dataset.inStock = inStock;
                productCard.innerHTML = `
                    <div class="overflow-hidden">
                        <img src="${images[0]?.url || 'https://placehold.co/600x400/111111/FFFFFF?text=Image'}" alt="${images[0]?.alt || product.title}" class="w-full h-64 object-cover">
                    </div>
                    <div class="p-6">
                        <h3 class="text-2xl font-bold">${product.title || 'Untitled'}</h3>
                        <p class="text-violet-400 text-xl font-medium mt-1">${price ? `£${parseFloat(price).toFixed(2)}` : ''}</p>
                        <button class="add-to-cart-btn mt-4 w-full bg-violet-600 text-white font-bold py-3 rounded-lg transition-all duration-300 hover:bg-violet-700" data-variant-id="${variant.id}" ${!inStock ? 'disabled' : ''}>
                            ${inStock ? 'Add to Cart' : 'Sold Out'}
                        </button>
                    </div>
                `;
                productGrid.appendChild(productCard);
            });
            observeScrollAnimations();
        }

        // --- Product Modal Logic ---
        function openProductModal(data) {
            modalTitle.textContent = data.title;
            modalPrice.textContent = `£${parseFloat(data.price).toFixed(2)}`;
            modalDescription.innerHTML = data.description;
            modalAddToCartBtn.dataset.variantId = data.variantId;
            modalAddToCartBtn.disabled = data.inStock !== 'true';
            modalAddToCartBtn.textContent = data.inStock === 'true' ? 'Add to Cart' : 'Sold Out';
            const images = JSON.parse(data.images);
            modalMainImage.src = images[0]?.url || '';
            modalMainImage.alt = images[0]?.alt || data.title;
            modalThumbnails.innerHTML = '';
            if (images.length > 1) {
                images.forEach(img => {
                    const thumb = document.createElement('img');
                    thumb.src = img.url;
                    thumb.alt = img.alt;
                    thumb.className = 'w-16 h-16 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-violet-400';
                    thumb.addEventListener('click', () => { modalMainImage.src = img.url; });
                    modalThumbnails.appendChild(thumb);
                });
            }
            productModal.classList.remove('hidden');
            setTimeout(() => productModal.classList.remove('opacity-0'), 10);
            setTimeout(() => productModal.querySelector('.product-modal-content').classList.remove('scale-95'), 10);
        }

        function closeProductModal() {
            productModal.classList.add('opacity-0');
            productModal.querySelector('.product-modal-content').classList.add('scale-95');
            setTimeout(() => productModal.classList.add('hidden'), 300);
        }

        // --- Cart Logic (Shopify) ---
        const cartFragment = `
            fragment CartFragment on Cart {
              id, checkoutUrl,
              lines(first: 100) { edges { node { id, quantity, merchandise { ... on ProductVariant { id, image { url }, price { amount }, product { title } } } } } },
              cost { subtotalAmount { amount } }
            }
        `;
        async function createCart() {
            const { data } = await shopifyFetch({ query: `mutation { cartCreate { cart { ...CartFragment } } } ${cartFragment}` });
            if (data?.cartCreate?.cart) {
                cartId = data.cartCreate.cart.id;
                checkoutUrl = data.cartCreate.cart.checkoutUrl;
                localStorage.setItem('shopifyCartId', cartId);
            }
        }
        async function addToCart(variantId) {
            const { data } = await shopifyFetch({ query: `mutation ($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFragment } } } ${cartFragment}`, variables: { cartId, lines: [{ merchandiseId: variantId, quantity: 1 }] } });
            if (data?.cartLinesAdd?.cart) updateCartUI(data.cartLinesAdd.cart);
        }
        async function fetchCart(id) {
             const { data } = await shopifyFetch({ query: `query ($cartId: ID!) { cart(id: $cartId) { ...CartFragment } } ${cartFragment}`, variables: { cartId: id } });
             if (data?.cart) updateCartUI(data.cart);
             else { localStorage.removeItem('shopifyCartId'); await createCart(); }
        }
        async function removeFromCart(lineId) {
            const { data } = await shopifyFetch({ query: `mutation ($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFragment } } } ${cartFragment}`, variables: { cartId, lineIds: [lineId] } });
            if(data?.cartLinesRemove?.cart) updateCartUI(data.cartLinesRemove.cart);
        }
        function updateCartUI(cart) {
            if (!cart) return;
            checkoutUrl = cart.checkoutUrl;
            let totalQuantity = 0;
            cartItemsContainer.innerHTML = '';
            if (cart.lines?.edges?.length > 0) {
                cart.lines.edges.forEach(({ node }) => {
                    totalQuantity += node.quantity;
                    cartItemsContainer.innerHTML += `
                        <div class="flex items-center gap-4">
                            <img src="${node.merchandise?.image?.url || ''}" alt="${node.merchandise?.product?.title || ''}" class="w-20 h-20 object-cover rounded-lg">
                            <div class="flex-grow">
                                <h4 class="font-bold">${node.merchandise?.product?.title || 'Product'}</h4>
                                <p class="text-neutral-400">Qty: ${node.quantity}</p>
                            </div>
                            <p class="font-bold">£${parseFloat(node.merchandise?.price?.amount || 0).toFixed(2)}</p>
                            <button class="remove-from-cart-btn text-red-500 hover:text-red-400 p-2" data-line-id="${node.id}">&times;</button>
                        </div>
                    `;
                });
                checkoutBtn.disabled = false;
            } else {
                cartItemsContainer.innerHTML = '<p class="text-neutral-500">Your cart is empty.</p>';
                checkoutBtn.disabled = true;
            }
            cartCount.textContent = totalQuantity;
            cartSubtotalEl.textContent = `£${parseFloat(cart.cost?.subtotalAmount?.amount || 0).toFixed(2)}`;
        }

        // --- Event Listeners ---
        const openCart = () => { cartPanel.classList.add('open'); cartOverlay.classList.remove('hidden'); };
        const closeCart = () => { cartPanel.classList.remove('open'); cartOverlay.classList.add('hidden'); };
        cartButton.addEventListener('click', openCart);
        closeCartButton.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', closeCart);
        productGrid.addEventListener('click', (e) => {
            const cartBtn = e.target.closest('.add-to-cart-btn');
            if (cartBtn) addToCart(cartBtn.dataset.variantId);
            else if (e.target.closest('.product-card')) openProductModal(e.target.closest('.product-card').dataset);
        });
        modalAddToCartBtn.addEventListener('click', (e) => {
            addToCart(e.target.dataset.variantId);
            closeProductModal();
            setTimeout(openCart, 500);
        });
        closeModalBtn.addEventListener('click', closeProductModal);
        productModal.addEventListener('click', (e) => { if (e.target === productModal) closeProductModal(); });
        cartItemsContainer.addEventListener('click', e => { if (e.target.classList.contains('remove-from-cart-btn')) removeFromCart(e.target.dataset.lineId); });
        checkoutBtn.addEventListener('click', () => { if (checkoutUrl) window.location.href = checkoutUrl; });

        // --- Animations ---
        if (heroHeading) {
            window.addEventListener('scroll', () => {
                const scrollY = window.scrollY;
                heroHeading.style.transform = `scale(${1 + scrollY * 0.001})`;
                heroHeading.style.opacity = 1 - Math.min(scrollY / 400, 1);
            });
        }
        if (canvas) {
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            let particles = [];
            class Particle {
                constructor() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.size = Math.random() * 1.5 + 0.5; this.speedX = Math.random() * 1 - 0.5; this.speedY = Math.random() * 1 - 0.5; this.color = `rgba(139, 92, 246, ${Math.random()})`; }
                update() { this.x += this.speedX; this.y += this.speedY; if (this.x > canvas.width || this.x < 0) this.speedX *= -1; if (this.y > canvas.height || this.y < 0) this.speedY *= -1; }
                draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); }
            }
            for (let i = 0; i < 50; i++) particles.push(new Particle());
            function animateParticles() { ctx.clearRect(0, 0, canvas.width, canvas.height); particles.forEach(p => { p.update(); p.draw(); }); requestAnimationFrame(animateParticles); }
            animateParticles();
        }
        faqItems.forEach(item => {
            const q = item.querySelector('.faq-question');
            const a = item.querySelector('.faq-answer');
            const arrow = item.querySelector('.faq-arrow');
            q.addEventListener('click', () => { if (a.style.maxHeight) { a.style.maxHeight = null; arrow.classList.remove('rotate-180'); } else { a.style.maxHeight = a.scrollHeight + "px"; arrow.classList.add('rotate-180'); } });
        });

        // --- App Initialization ---
        async function initialize() {
            if (cartId) await fetchCart(cartId);
            else await createCart();
            await fetchProducts();
        }
        initialize();
    }


    // =================================================================
    //   BLOG PAGE SPECIFIC LOGIC
    // =================================================================
    const articleModal = document.getElementById('article-modal');

    // --- Run blog logic only if the article modal exists on the page ---
    if(articleModal) {
        const articleCards = document.querySelectorAll('.article-card');
        const modalTitle = articleModal.querySelector('#modal-title');
        const modalContent = articleModal.querySelector('#modal-content');
        const closeModalBtn = articleModal.querySelector('#close-modal-btn');

        const openModal = (articleId) => {
            const contentTemplate = document.getElementById(`${articleId}-content`);
            const articleTitle = document.querySelector(`.article-card[data-article="${articleId}"] h2`).textContent;

            if (contentTemplate) {
                modalTitle.textContent = articleTitle;
                modalContent.innerHTML = contentTemplate.innerHTML;
                articleModal.classList.remove('hidden');
                setTimeout(() => articleModal.classList.remove('opacity-0'), 10);
                setTimeout(() => articleModal.querySelector('.article-modal-content').classList.remove('scale-95'), 10);
            }
        };

        const closeModal = () => {
            articleModal.classList.add('opacity-0');
            articleModal.querySelector('.article-modal-content').classList.add('scale-95');
            setTimeout(() => articleModal.classList.add('hidden'), 300);
        };

        articleCards.forEach(card => {
            card.addEventListener('click', () => {
                openModal(card.dataset.article);
            });
        });

        closeModalBtn.addEventListener('click', closeModal);
        articleModal.addEventListener('click', (e) => {
            if (e.target === articleModal) {
                closeModal();
            }
        });
    }
});


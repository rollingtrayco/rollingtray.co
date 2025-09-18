document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    //   GLOBAL & UTILITY FUNCTIONS
    // =================================================================
    
    function observeScrollAnimations() {
        const scrollElements = document.querySelectorAll('.scroll-animate:not(.visible)');
        if (!scrollElements.length) return;
        
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

    // =================================================================
    //   HOMEPAGE INITIALIZER
    // =================================================================
    function initHomepage() {
        const shopifyConfig = {
            domain: 'connoisseurcustoms.myshopify.com',
            storefrontAccessToken: '75774095f9799705fcc69b5a3d6b29a3',
        };

        const productGrid = document.getElementById('product-grid');
        const productModal = document.getElementById('product-modal');
        const cartButton = document.getElementById('cart-button');
        const closeCartButton = document.getElementById('close-cart-btn');
        const cartPanel = document.getElementById('cart-panel');
        const cartOverlay = document.getElementById('cart-overlay');
        const cartCount = document.getElementById('cart-count');
        const cartItemsContainer = document.getElementById('cart-items');
        const cartSubtotalEl = document.getElementById('cart-subtotal');
        const checkoutBtn = document.getElementById('checkout-btn');
        let cartId = localStorage.getItem('shopifyCartId');
        let cart = {};

        // --- ROBUST Shopify API Fetch Function ---
        async function shopifyFetch({ query, variables }) {
            try {
                const response = await fetch(`https://${shopifyConfig.domain}/api/2024-04/graphql.json`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': shopifyConfig.storefrontAccessToken },
                    body: JSON.stringify({ query, variables }),
                });
                if (!response.ok) throw new Error(`Shopify API Error: ${response.statusText}`);
                return response.json();
            } catch (error) {
                console.error("Error in shopifyFetch:", error);
                return { errors: [{ message: error.message }] };
            }
        }
        
        const cartFragment = `fragment CartFragment on Cart { id checkoutUrl lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id image { url } price { amount } product { title } } } } } } cost { subtotalAmount { amount } } }`;

        // --- Fetch and Display Products ---
        async function fetchProducts() {
            const productsQuery = `query getProducts { products(first: 9) { edges { node { id title handle descriptionHtml priceRange { minVariantPrice { amount } } images(first: 5) { edges { node { url altText } } } variants(first: 1) { edges { node { id availableForSale } } } } } } }`;
            const response = await shopifyFetch({ query: productsQuery });
            if (response.data && response.data.products) {
                renderProducts(response.data.products.edges);
            } else {
                console.error("Failed to fetch products:", response.errors);
                productGrid.innerHTML = '<div class="col-span-full text-center text-red-400">Could not load products. Please check the console for errors.</div>';
            }
        }

        function renderProducts(products) {
            productGrid.innerHTML = '';
            products.forEach(({ node: product }) => {
                const imageUrl = product.images?.edges?.[0]?.node?.url;
                productGrid.innerHTML += `<div class="product-card bg-[#111] rounded-xl overflow-hidden scroll-animate cursor-pointer" data-product-handle="${product.handle}"><div class="overflow-hidden"><img src="${imageUrl || 'https://placehold.co/600x400/111/FFF?text=Image'}" alt="${product.title}" class="w-full h-64 object-cover"></div><div class="p-6"><h3 class="text-2xl font-bold">${product.title}</h3><p class="text-violet-400 text-xl font-medium mt-1">£${parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}</p></div></div>`;
            });
            observeScrollAnimations();
        }
        
        // --- Product Modal Logic ---
        async function openProductModal(handle) {
            const productQuery = `query getProduct($handle: String!) { product(handle: $handle) { id title descriptionHtml priceRange { minVariantPrice { amount } } images(first: 5) { edges { node { url altText } } } variants(first: 1) { edges { node { id availableForSale } } } } }`;
            const response = await shopifyFetch({ query: productQuery, variables: { handle } });
            if (!response.data || !response.data.product) return;
            
            const product = response.data.product;
            productModal.querySelector('#modal-title').textContent = product.title;
            productModal.querySelector('#modal-price').textContent = `£${parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}`;
            productModal.querySelector('#modal-description').innerHTML = product.descriptionHtml;
            
            const addToCartBtn = productModal.querySelector('#modal-add-to-cart-btn');
            addToCartBtn.dataset.variantId = product.variants.edges[0].node.id;
            const inStock = product.variants.edges[0].node.availableForSale;
            addToCartBtn.disabled = !inStock;
            addToCartBtn.textContent = inStock ? 'Add to Cart' : 'Sold Out';
            
            const mainImage = productModal.querySelector('#modal-main-image');
            mainImage.src = product.images.edges[0].node.url;
            const imageGallery = productModal.querySelector('#modal-image-gallery');
            imageGallery.innerHTML = '';
            product.images.edges.forEach(edge => {
                imageGallery.innerHTML += `<img src="${edge.node.url}" class="thumbnail w-16 h-16 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-violet-500">`;
            });
            productModal.classList.remove('hidden');
        }
        function closeProductModal() { productModal.classList.add('hidden'); }
        
        // --- Cart Logic ---
        async function createCart() {
            const response = await shopifyFetch({ query: `mutation { cartCreate { cart { ...CartFragment } } } ${cartFragment}` });
            if (response.data?.cartCreate?.cart) {
                const newCart = response.data.cartCreate.cart;
                cartId = newCart.id;
                localStorage.setItem('shopifyCartId', cartId);
                updateCartUI(newCart);
            }
        }
        async function fetchCart() {
             const response = await shopifyFetch({ query: `query ($cartId: ID!) { cart(id: $cartId) { ...CartFragment } } ${cartFragment}`, variables: { cartId } });
             if (response.data?.cart) {
                updateCartUI(response.data.cart);
             } else {
                localStorage.removeItem('shopifyCartId');
                await createCart();
             }
        }
        async function addToCart(variantId) {
            const response = await shopifyFetch({ query: `mutation ($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFragment } } } ${cartFragment}`, variables: { cartId, lines: [{ merchandiseId: variantId, quantity: 1 }] } });
            if (response.data?.cartLinesAdd?.cart) updateCartUI(response.data.cartLinesAdd.cart);
        }
        async function removeFromCart(lineId) {
            const response = await shopifyFetch({ query: `mutation ($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFragment } } } ${cartFragment}`, variables: { cartId, lineIds: [lineId] } });
            if(response.data?.cartLinesRemove?.cart) updateCartUI(response.data.cartLinesRemove.cart);
        }
        function updateCartUI(cartData) {
            if (!cartData) return;
            cart = cartData;
            let totalQuantity = 0;
            cartItemsContainer.innerHTML = '';
            if (cart.lines?.edges?.length > 0) {
                cart.lines.edges.forEach(({ node }) => {
                    totalQuantity += node.quantity;
                    cartItemsContainer.innerHTML += `<div class="flex items-center gap-4 mb-4"><img src="${node.merchandise?.image?.url || ''}" class="w-20 h-20 object-cover rounded-lg"><div class="flex-grow"><h4 class="font-bold">${node.merchandise?.product?.title}</h4><p class="text-neutral-400">Qty: ${node.quantity}</p></div><p class="font-bold">£${parseFloat(node.merchandise?.price?.amount).toFixed(2)}</p><button class="remove-from-cart-btn text-red-400 hover:text-red-500 p-1 text-2xl" data-line-id="${node.id}">&times;</button></div>`;
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
        productGrid.addEventListener('click', e => e.target.closest('.product-card') && openProductModal(e.target.closest('.product-card').dataset.productHandle));
        productModal.addEventListener('click', e => {
            if (e.target.id === 'close-modal-btn' || e.target === productModal) closeProductModal();
            if (e.target.classList.contains('thumbnail')) productModal.querySelector('#modal-main-image').src = e.target.src;
            if (e.target.id === 'modal-add-to-cart-btn') { addToCart(e.target.dataset.variantId); closeProductModal(); }
        });
        cartButton.addEventListener('click', () => { cartPanel.classList.add('open'); cartOverlay.classList.remove('hidden'); });
        const closeCart = () => { cartPanel.classList.remove('open'); cartOverlay.classList.add('hidden'); };
        closeCartButton.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', closeCart);
        cartItemsContainer.addEventListener('click', e => e.target.closest('.remove-from-cart-btn') && removeFromCart(e.target.closest('.remove-from-cart-btn').dataset.lineId));
        checkoutBtn.addEventListener('click', () => cart.checkoutUrl && (window.location.href = cart.checkoutUrl));
        
        // --- Animations ---
        const heroHeading = document.getElementById('hero-heading');
        if (heroHeading) {
            window.addEventListener('scroll', () => {
               const scrollY = window.scrollY;
               const scale = 1 + scrollY * 0.001;
               const opacity = 1 - Math.min(scrollY / 400, 1);
               heroHeading.style.transform = `scale(${scale})`;
               heroHeading.style.opacity = opacity;
            });
        }

        // --- Final Init ---
        (async () => {
            if (cartId) await fetchCart();
            else await createCart();
            await fetchProducts();
            observeScrollAnimations();
        })();
    }

    // =================================================================
    //   BLOG PAGE INITIALIZER
    // =================================================================
    function initBlogpage() {
        const articleGrid = document.getElementById('article-grid');
        const articleModal = document.getElementById('article-modal');
        if (!articleGrid || !articleModal) return;

        const modalTitle = articleModal.querySelector('#modal-title');
        const modalContent = articleModal.querySelector('#modal-content');
        const closeModalBtn = articleModal.querySelector('#close-modal-btn');

        const openModal = (articleId, title) => {
            const contentTemplate = document.getElementById(`${articleId}-content`);
            if (!contentTemplate) { console.error("Could not find content for article:", articleId); return; }
            modalTitle.textContent = title;
            modalContent.innerHTML = contentTemplate.innerHTML;
            articleModal.classList.remove('hidden', 'opacity-0');
            articleModal.querySelector('.article-modal-content').classList.remove('scale-95');
        };

        const closeModal = () => {
            articleModal.classList.add('opacity-0');
            articleModal.querySelector('.article-modal-content').classList.add('scale-95');
            setTimeout(() => articleModal.classList.add('hidden'), 300);
        };

        articleGrid.addEventListener('click', (event) => {
            const clickedCard = event.target.closest('.article-card');
            if (!clickedCard) return;
            openModal(clickedCard.dataset.article, clickedCard.querySelector('h2').textContent);
        });

        closeModalBtn.addEventListener('click', closeModal);
        articleModal.addEventListener('click', (e) => (e.target === articleModal) && closeModal());
        observeScrollAnimations();
    }

    // =================================================================
    //   PAGE ROUTER
    // =================================================================
    if (document.getElementById('product-grid')) {
        initHomepage();
    } else if (document.getElementById('article-grid')) {
        initBlogpage();
    }
});


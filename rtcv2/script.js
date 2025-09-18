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
            if (!response.data || !response.data.product) {
                console.error("Failed to fetch product details for handle:", handle);
                return;
            }
            
            const product = response.data.product;
            productModal.querySelector('#modal-title').textContent = product.title;
            productModal.querySelector('#modal-price').textContent = `£${parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}`;
            productModal.querySelector('#modal-description').innerHTML = product.descriptionHtml;
            
            const addToCartBtn = productModal.querySelector('#modal-add-to-cart-btn');
            addToCartBtn.dataset.variantId = product.variants.edges[0].node.id;
            const inStock = product.variants.edges[0].node.availableForSale;
            addToCartBtn.disabled = !inStock;
            addToCartBtn.textContent = inStock ? 'Add to Cart' : 'Sold Out';
            
            // ** THE FIX IS HERE: Robust image handling **
            const mainImage = productModal.querySelector('#modal-main-image');
            const imageGallery = productModal.querySelector('#modal-image-gallery');
            imageGallery.innerHTML = ''; // Clear previous images

            if (product.images.edges.length > 0) {
                // If there are images, display them
                mainImage.src = product.images.edges[0].node.url;
                mainImage.alt = product.images.edges[0].node.altText || product.title;
                product.images.edges.forEach(edge => {
                    imageGallery.innerHTML += `<img src="${edge.node.url}" alt="${edge.node.altText || product.title}" class="thumbnail w-16 h-16 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-violet-500">`;
                });
            } else {
                // If there are NO images, display a placeholder
                const placeholderUrl = `https://placehold.co/600x600/111/FFF?text=${encodeURIComponent(product.title)}`;
                mainImage.src = placeholderUrl;
                mainImage.alt = product.title;
            }

            productModal.classList.remove('hidden');
        }
        function closeProductModal() { productModal.classList.add('hidden'); }
        
        // --- Cart Logic ---
        async function createCart() { /* (omitted for brevity - same as before) */ }
        async function fetchCart() { /* (omitted for brevity - same as before) */ }
        async function addToCart(variantId) { /* (omitted for brevity - same as before) */ }
        async function removeFromCart(lineId) { /* (omitted for brevity - same as before) */ }
        function updateCartUI(cartData) { /* (omitted for brevity - same as before) */ }

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
        if (heroHeading) { /* (omitted for brevity - same as before) */ }

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
    function initBlogpage() { /* (omitted for brevity - same as before) */ }

    // =================================================================
    //   PAGE ROUTER
    // =================================================================
    if (document.getElementById('product-grid')) {
        initHomepage();
    } else if (document.getElementById('article-grid')) {
        initBlogpage();
    }
});


document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    //   GLOBAL & UTILITY FUNCTIONS
    // =================================================================
    
    // --- Shared scroll animation observer ---
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
            }
        }
        
        const cartFragment = `
            fragment CartFragment on Cart {
              id
              checkoutUrl
              lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id image { url } price { amount } product { title } } } } } }
              cost { subtotalAmount { amount } }
            }`;

        // --- Fetch and Display Products ---
        async function fetchProducts() {
            const productsQuery = `query getProducts { products(first: 9) { edges { node { id title handle descriptionHtml priceRange { minVariantPrice { amount } } images(first: 5) { edges { node { url altText } } } variants(first: 1) { edges { node { id availableForSale } } } } } } }`;
            const { data } = await shopifyFetch({ query: productsQuery });
            if (data && data.products) {
                renderProducts(data.products.edges);
            }
        }

        function renderProducts(products) {
            productGrid.innerHTML = '';
            products.forEach(({ node: product }) => {
                const variant = product.variants.edges[0].node;
                const imageUrl = product.images?.edges?.[0]?.node?.url;
                productGrid.innerHTML += `
                    <div class="product-card bg-[#111] rounded-xl overflow-hidden scroll-animate cursor-pointer" data-product-handle="${product.handle}">
                        <div class="overflow-hidden"><img src="${imageUrl || 'https://placehold.co/600x400/111/FFF?text=Image'}" alt="${product.title}" class="w-full h-64 object-cover"></div>
                        <div class="p-6">
                            <h3 class="text-2xl font-bold">${product.title}</h3>
                            <p class="text-violet-400 text-xl font-medium mt-1">£${parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}</p>
                        </div>
                    </div>
                `;
            });
            observeScrollAnimations();
        }
        
        // --- Product Modal Logic ---
        async function openProductModal(handle) {
            const productQuery = `query getProduct($handle: String!) { product(handle: $handle) { id title descriptionHtml priceRange { minVariantPrice { amount } } images(first: 5) { edges { node { url altText } } } variants(first: 1) { edges { node { id availableForSale } } } } }`;
            const { data } = await shopifyFetch({ query: productQuery, variables: { handle } });
            if (!data || !data.product) return;

            const product = data.product;
            const variantId = product.variants.edges[0].node.id;
            const inStock = product.variants.edges[0].node.availableForSale;

            productModal.querySelector('#modal-title').textContent = product.title;
            productModal.querySelector('#modal-price').textContent = `£${parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}`;
            productModal.querySelector('#modal-description').innerHTML = product.descriptionHtml;
            
            const addToCartBtn = productModal.querySelector('#modal-add-to-cart-btn');
            addToCartBtn.dataset.variantId = variantId;
            addToCartBtn.disabled = !inStock;
            addToCartBtn.textContent = inStock ? 'Add to Cart' : 'Sold Out';

            const imageGallery = productModal.querySelector('#modal-image-gallery');
            const mainImage = productModal.querySelector('#modal-main-image');
            
            mainImage.src = product.images.edges[0].node.url;
            imageGallery.innerHTML = '';
            product.images.edges.forEach(edge => {
                imageGallery.innerHTML += `<img src="${edge.node.url}" class="thumbnail w-16 h-16 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-violet-500">`;
            });

            productModal.classList.remove('hidden');
        }

        function closeProductModal() {
            productModal.classList.add('hidden');
        }
        
        // --- Cart Logic ---
        async function createCart() {
            const { data } = await shopifyFetch({ query: `mutation { cartCreate { cart { id checkoutUrl } } }` });
            if (data?.cartCreate?.cart) {
                cartId = data.cartCreate.cart.id;
                localStorage.setItem('shopifyCartId', cartId);
            }
        }
        async function addToCart(variantId) {
            const { data } = await shopifyFetch({ query: `mutation ($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFragment } } } ${cartFragment}`, variables: { cartId, lines: [{ merchandiseId: variantId, quantity: 1 }] } });
            if (data?.cartLinesAdd?.cart) updateCartUI(data.cartLinesAdd.cart);
        }
        async function fetchCart() {
             const { data } = await shopifyFetch({ query: `query ($cartId: ID!) { cart(id: $cartId) { ...CartFragment } } ${cartFragment}`, variables: { cartId } });
             if (data?.cart) updateCartUI(data.cart);
             else { localStorage.removeItem('shopifyCartId'); await createCart(); }
        }
        async function removeFromCart(lineId) {
            const { data } = await shopifyFetch({ query: `mutation ($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFragment } } } ${cartFragment}`, variables: { cartId, lineIds: [lineId] } });
            if(data?.cartLinesRemove?.cart) updateCartUI(data.cartLinesRemove.cart);
        }
        function updateCartUI(cart) { /* (omitted for brevity - same as before) */ }

        // --- Event Listeners ---
        productGrid.addEventListener('click', e => e.target.closest('.product-card') && openProductModal(e.target.closest('.product-card').dataset.productHandle));
        productModal.addEventListener('click', e => {
            if (e.target.id === 'close-modal-btn' || e.target === productModal) closeProductModal();
            if (e.target.classList.contains('thumbnail')) productModal.querySelector('#modal-main-image').src = e.target.src;
            if (e.target.id === 'modal-add-to-cart-btn') { addToCart(e.target.dataset.variantId); closeProductModal(); }
        });
        cartButton.addEventListener('click', () => cartPanel.classList.add('open'));
        closeCartButton.addEventListener('click', () => cartPanel.classList.remove('open'));
        cartItemsContainer.addEventListener('click', e => e.target.closest('.remove-from-cart-btn') && removeFromCart(e.target.closest('.remove-from-cart-btn').dataset.lineId));
        checkoutBtn.addEventListener('click', () => cart.checkoutUrl && (window.location.href = cart.checkoutUrl));
        
        // --- Animations & Final Init ---
        // (omitted for brevity - same hero animations as before)
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
            if (!contentTemplate) {
                console.error("Could not find content for article:", articleId);
                return;
            }

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

            const articleId = clickedCard.dataset.article;
            const articleTitle = clickedCard.querySelector('h2').textContent;
            openModal(articleId, articleTitle);
        });

        closeModalBtn.addEventListener('click', closeModal);
        articleModal.addEventListener('click', (e) => (e.target === articleModal) && closeModal());
        observeScrollAnimations();
    }

    // =================================================================
    //   PAGE ROUTER: Detect which page we're on and run its initializer
    // =================================================================
    if (document.getElementById('product-grid')) {
        initHomepage();
    } else if (document.getElementById('article-grid')) {
        initBlogpage();
    }
});


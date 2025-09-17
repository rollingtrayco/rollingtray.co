document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    //   Shopify Configuration - EDIT THESE VALUES
    // =================================================================
    const shopifyConfig = {
        domain: 'connoisseurcustoms.myshopify.com', // Corrected domain
        storefrontAccessToken: '75774095f9799705fcc69b5a3d6b29a3', // Your public token
    };
    // =================================================================

    const productGrid = document.getElementById('product-grid');
    const cartButton = document.getElementById('cart-button');
    const closeCartButton = document.getElementById('close-cart-btn');
    const cartPanel = document.getElementById('cart-panel');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartCount = document.getElementById('cart-count');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const checkoutBtn = document.getElementById('checkout-btn');
    let cartId = localStorage.getItem('shopifyCartId');
    let checkoutUrl = '';

    // Product Modal Elements
    const productModal = document.getElementById('product-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalMainImage = document.getElementById('modal-main-image');
    const modalThumbnails = document.getElementById('modal-thumbnails');
    const modalTitle = document.getElementById('modal-title');
    const modalPrice = document.getElementById('modal-price');
    const modalDescription = document.getElementById('modal-description');
    const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');


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

    // --- Fetch and Display Products ---
    async function fetchProducts() {
        const productsQuery = `
            query getProducts {
              products(first: 9) {
                edges {
                  node {
                    id
                    title
                    handle
                    descriptionHtml
                    priceRange {
                      minVariantPrice {
                        amount
                        currencyCode
                      }
                    }
                    images(first: 5) {
                      edges {
                        node {
                          url
                          altText
                        }
                      }
                    }
                    variants(first: 1) {
                       edges {
                           node {
                               id
                               availableForSale
                               quantityAvailable
                           }
                       }
                    }
                  }
                }
              }
            }
        `;
        const { data, errors } = await shopifyFetch({ query: productsQuery });
        if (errors) {
            console.error("Error fetching products:", errors);
            if(productGrid) productGrid.innerHTML = '<div class="text-center col-span-full text-red-400">Could not load products. Please check API credentials and try again.</div>';
            return;
        }
        if (data && data.products) {
            if(productGrid) renderProducts(data.products.edges);
        } else {
            if(productGrid) productGrid.innerHTML = '<div class="text-center col-span-full">No products found.</div>';
        }
    }

    function renderProducts(products) {
        productGrid.innerHTML = ''; // Clear loading state
        products.forEach(({ node: product }) => {
            if (!product?.variants?.edges?.length) return;
            
            const variant = product.variants.edges[0].node;
            const inStock = variant?.availableForSale;
            const price = product.priceRange?.minVariantPrice?.amount;
            const images = product.images.edges.map(edge => ({ url: edge.node.url, alt: edge.node.altText }));

            const productCard = document.createElement('div');
            productCard.className = 'bg-[#111] rounded-xl overflow-hidden scroll-animate product-card';
            // Store data for the modal
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
                    <h3 class="text-2xl font-bold">${product.title || 'Untitled Product'}</h3>
                    <p class="text-violet-400 text-xl font-medium mt-1">${price ? `£${parseFloat(price).toFixed(2)}` : 'Price unavailable'}</p>
                    <button class="add-to-cart-btn mt-4 w-full bg-violet-600 text-white font-bold py-3 rounded-lg transition-all duration-300 hover:bg-violet-700 hover:scale-105" data-variant-id="${variant.id}" ${!inStock ? 'disabled' : ''}>
                        ${inStock ? 'Add to Cart' : 'Sold Out'}
                    </button>
                </div>
            `;
            productGrid.appendChild(productCard);
        });
        observeScrollAnimations();
    }
    
    // --- Product Modal Logic ---
    function openProductModal(productData) {
        modalTitle.textContent = productData.title;
        modalPrice.textContent = `£${parseFloat(productData.price).toFixed(2)}`;
        modalDescription.innerHTML = productData.description;
        modalAddToCartBtn.dataset.variantId = productData.variantId;
        modalAddToCartBtn.disabled = productData.inStock !== 'true';
        modalAddToCartBtn.textContent = productData.inStock === 'true' ? 'Add to Cart' : 'Sold Out';

        const images = JSON.parse(productData.images);
        modalMainImage.src = images[0]?.url || '';
        modalMainImage.alt = images[0]?.alt || productData.title;
        modalThumbnails.innerHTML = '';
        if (images.length > 1) {
            images.forEach(image => {
                const thumb = document.createElement('img');
                thumb.src = image.url;
                thumb.alt = image.alt;
                thumb.className = 'w-16 h-16 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-violet-400';
                thumb.addEventListener('click', () => {
                    modalMainImage.src = image.url;
                });
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
    async function createCart() {
        const createCartMutation = `
            mutation {
              cartCreate {
                cart { id checkoutUrl }
              }
            }
        `;
        const { data } = await shopifyFetch({ query: createCartMutation });
        if (data?.cartCreate?.cart) {
            cartId = data.cartCreate.cart.id;
            checkoutUrl = data.cartCreate.cart.checkoutUrl;
            localStorage.setItem('shopifyCartId', cartId);
        }
    }
    async function addToCart(variantId) {
        const lines = [{ merchandiseId: variantId, quantity: 1 }];
        const addToCartMutation = `
            mutation ($cartId: ID!, $lines: [CartLineInput!]!) {
              cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFragment } }
            }
            ${cartFragment}
        `;
        const { data } = await shopifyFetch({ query: addToCartMutation, variables: { cartId, lines } });
        if (data?.cartLinesAdd?.cart) {
            updateCartUI(data.cartLinesAdd.cart);
        }
    }
    async function fetchCart(cartId) {
         const getCartQuery = `
            query ($cartId: ID!) {
              cart(id: $cartId) { ...CartFragment }
            }
            ${cartFragment}
         `;
         const { data } = await shopifyFetch({ query: getCartQuery, variables: { cartId } });
         if (data?.cart) {
            updateCartUI(data.cart);
         } else {
            localStorage.removeItem('shopifyCartId');
            await createCart();
         }
    }
    async function removeFromCart(lineId) {
        const removeFromCartMutation = `
            mutation ($cartId: ID!, $lineIds: [ID!]!) {
              cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFragment } }
            }
            ${cartFragment}
        `;
        const { data } = await shopifyFetch({ query: removeFromCartMutation, variables: { cartId, lineIds: [lineId] } });
        if(data?.cartLinesRemove?.cart) {
            updateCartUI(data.cartLinesRemove.cart);
        }
    }
    const cartFragment = `
        fragment CartFragment on Cart {
          id
          checkoutUrl
          lines(first: 100) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    image { url }
                    price { amount }
                    product { title }
                  }
                }
              }
            }
          }
          cost {
            subtotalAmount { amount }
          }
        }
    `;
    function updateCartUI(cart) {
        if (!cart) return;
        checkoutUrl = cart.checkoutUrl;
        let totalQuantity = 0;
        cartItemsContainer.innerHTML = '';
        if (cart.lines?.edges?.length > 0) {
            cart.lines.edges.forEach(({ node }) => {
                totalQuantity += node.quantity;
                const imageUrl = node.merchandise?.image?.url || `https://placehold.co/80x80/111111/FFFFFF?text=Image`;
                const title = node.merchandise?.product?.title || 'Product';
                const price = node.merchandise?.price?.amount || 0;
                
                cartItemsContainer.innerHTML += `
                    <div class="flex items-center gap-4">
                        <img src="${imageUrl}" alt="${title}" class="w-20 h-20 object-cover rounded-lg">
                        <div class="flex-grow">
                            <h4 class="font-bold">${title}</h4>
                            <p class="text-neutral-400">Quantity: ${node.quantity}</p>
                        </div>
                        <p class="font-bold">£${parseFloat(price).toFixed(2)}</p>
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
        const subtotal = cart.cost?.subtotalAmount?.amount || 0;
        cartSubtotalEl.textContent = `£${parseFloat(subtotal).toFixed(2)}`;
    }

    // --- Event Listeners ---
    const openCart = () => {
        cartPanel.classList.add('open');
        cartOverlay.classList.remove('hidden');
    };
    const closeCart = () => {
        cartPanel.classList.remove('open');
        cartOverlay.classList.add('hidden');
    };
    
    if(cartButton) cartButton.addEventListener('click', openCart);
    if(closeCartButton) closeCartButton.addEventListener('click', closeCart);
    if(cartOverlay) cartOverlay.addEventListener('click', closeCart);

    if(productGrid) {
        productGrid.addEventListener('click', (e) => {
            const cartButton = e.target.closest('.add-to-cart-btn');
            const productCard = e.target.closest('.product-card');

            if (cartButton) {
                const variantId = cartButton.dataset.variantId;
                if(variantId) addToCart(variantId);
            } else if (productCard) {
                openProductModal(productCard.dataset);
            }
        });
    }
    
    if(modalAddToCartBtn) {
        modalAddToCartBtn.addEventListener('click', (e) => {
            const variantId = e.target.dataset.variantId;
            if(variantId) {
                addToCart(variantId);
                closeProductModal();
                setTimeout(openCart, 500); // Open cart after adding
            }
        });
    }
    
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeProductModal);
    if(productModal) productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeProductModal();
    });

    
    if(cartItemsContainer) {
        cartItemsContainer.addEventListener('click', e => {
            if (e.target.classList.contains('remove-from-cart-btn')) {
                const lineId = e.target.dataset.lineId;
                if(lineId) removeFromCart(lineId);
            }
        });
    }

    if(checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (checkoutUrl) window.location.href = checkoutUrl;
        });
    }
    
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        const arrow = item.querySelector('.faq-arrow');
        question.addEventListener('click', () => {
            if (answer.style.maxHeight) {
                answer.style.maxHeight = null;
                arrow.classList.remove('rotate-180');
            } else {
                answer.style.maxHeight = answer.scrollHeight + "px";
                arrow.classList.add('rotate-180');
            }
        });
    });

    // --- Animation Scripts ---
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

    const heroHeading = document.getElementById('hero-heading');
    if(heroHeading) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const scale = 1 + scrollY * 0.001;
            const opacity = 1 - Math.min(scrollY / 400, 1);
            if (heroHeading) {
               heroHeading.style.transform = `scale(${scale})`;
               heroHeading.style.opacity = opacity;
            }
        });
    }

    const canvas = document.getElementById('particle-canvas');
    if(canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let particles = [];
        const particleCount = 50;

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 1.5 + 0.5;
                this.speedX = Math.random() * 1 - 0.5;
                this.speedY = Math.random() * 1 - 0.5;
                this.color = `rgba(139, 92, 246, ${Math.random()})`;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
                if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
            }
            draw() {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        function initParticles() {
            for (let i = 0; i < particleCount; i++) particles.push(new Particle());
        }
        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }
            requestAnimationFrame(animateParticles);
        }
        initParticles();
        animateParticles();
    }
    
    const heroTextContainer = document.getElementById('hero-text-container');
    if(heroTextContainer) {
        window.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const x = (clientX / window.innerWidth - 0.5) * 40;
            const y = (clientY / window.innerHeight - 0.5) * 40;
            if (heroTextContainer) heroTextContainer.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
        });
    }
    
    // --- App Initialization ---
    async function initialize() {
        if (cartId) await fetchCart(cartId);
        else await createCart();
        await fetchProducts();
    }
    
    observeScrollAnimations(); // Initial call for static elements
    initialize();
});

// Utility functions
const utils = {
  setActive: (selector, activeClass = 'active') => {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.remove(activeClass);
    });
    const current = document.querySelector(`${selector}[href="${window.location.pathname}"]`);
    if (current) current.classList.add(activeClass);
  },

 showPage: (pageId) => {
  document.querySelectorAll('main > [data-page]').forEach(page => {
    page.classList.add('hidden');
  });

  const page = document.getElementById(pageId);
  if (page) {
    page.classList.remove('hidden');
  }
},

  createElement: (tag, className = '', innerHTML = '') => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  },

  generateId: () => '_' + Math.random().toString(36).substr(2, 9),
};






//______________________________________________________________________________________________________________________
//______________________________________________________________________________________________________________________


// License Database - Add your licenses here
const licenseDatabase = {
  'FL-0210001': {
    license_number: 'FL-0210001',
    friends_1: 'Vibhushi',
    friends_2: 'Abhinav',
    issued_date: '25/07/2026',
    expiry_date: 'Lifetime',
    certification_code: 'BFF-CERT-0210001',
    license_status: 'FOREVER ACTIVE',
    password: 'FL-0210001',
    image_folder: 'licenses/FL-0210001',
  },

  'FL-0210002': {
    license_number: 'FL-0210002',
    friends_1: 'MAHI',
    friends_2: 'ABHINAV',
    issued_date: '25/07/2026',
    expiry_date: 'Lifetime',
    certification_code: 'BFF-CERT-0210002',
    license_status: 'ACTIVE',
    password: 'FL-0210002',
    image_folder: 'licenses/FL-0210002',
  },

  // Add more IDs below:
  // 'FL-0210003': {
  //   license_number: 'FL-0210003',
  //   friends_1: 'Name 1',
  //   friends_2: 'Name 2',
  //   issued_date: '25/07/2026',
  //   expiry_date: 'Lifetime',
  //   certification_code: 'BFF-CERT-0210003',
  //   license_status: 'ACTIVE',
  //   password: 'your-password',
  //   image_folder: 'licenses/FL-0210003',
  // },
};

//______________________________________________________________________________________________________________________
//______________________________________________________________________________________________________________________





// Current loaded license
let currentLicense = null;

const protectedPages = ['license', 'gallery', 'likings'];

const isLicenseVerified = () => {
  return currentLicense !== null;
};

const updateProtectedVisibility = () => {
  document
    .querySelectorAll(
      '.nav-links a[data-page="license"], ' +
      '.nav-links a[data-page="gallery"], ' +
      '.nav-links a[data-page="likings"], ' +
      '.action-card[data-page="license"]'
    )
    .forEach(element => {
      element.classList.toggle('hidden', !isLicenseVerified());
    });
};

const logoutLicense = () => {
  currentLicense = null;
  updateProtectedVisibility();
  utils.showPage('verify');
};

// Storage Manager
const storage = {
  gallery: {
  get: () => {
    const cardId = currentLicense?.license_number || 'default';
    return JSON.parse(
      localStorage.getItem(`gallery_images_${cardId}`) || '[]'
    );
  },

  set: (images) => {
    const cardId = currentLicense?.license_number || 'default';
    localStorage.setItem(
      `gallery_images_${cardId}`,
      JSON.stringify(images)
    );
  },

  add: (image) => {
    const images = storage.gallery.get();
    images.push({
      ...image,
      id: utils.generateId()
    });
    storage.gallery.set(images);
  },

  remove: (id) => {
    let images = storage.gallery.get();
    images = images.filter(img => img.id !== id);
    storage.gallery.set(images);
  },
},
  likings: {
  get: () => {
    const cardId = currentLicense?.license_number || 'default';

    return JSON.parse(
      localStorage.getItem(`likings_data_${cardId}`) ||
      JSON.stringify({
        'Favorite Foods': ['Pizza', 'Sushi', 'Tacos'],
        'Favorite Movies': ['Spirited Away', 'Your Name', 'A Silent Voice'],
        'Favorite Places': ['Café', 'Beach', 'Park'],
        'Favorite Colors': ['Pink', 'Lavender', 'Peach'],
      })
    );
  },

  set: (data) => {
    const cardId = currentLicense?.license_number || 'default';

    localStorage.setItem(
      `likings_data_${cardId}`,
      JSON.stringify(data)
    );
  },
},
};

// Floating Hearts Animation
const floatingHearts = () => {
  const container = document.querySelector('.floating-hearts');
  if (!container) return;

  const createHeart = () => {
    const heart = utils.createElement('div', 'heart', '♡');
    heart.style.left = Math.random() * window.innerWidth + 'px';
    heart.style.top = window.innerHeight + 'px';
    heart.style.color = ['#ff9dcb', '#ffd6e8', '#e8d5f2', '#ffd1b8'][Math.floor(Math.random() * 4)];
    container.appendChild(heart);

    setTimeout(() => heart.remove(), 2000);
  };

  setInterval(createHeart, 800);
};

// Navigation
const initNavigation = () => {
  const navLinks = document.querySelectorAll('.nav-links a[data-page]');
  const actionCards = document.querySelectorAll('.action-card[data-page]');

  function openPage(pageId) {
    if (protectedPages.includes(pageId) && !isLicenseVerified()) {
      alert('Please verify your card ID first.');
      pageId = 'verify';
    }

    navLinks.forEach(link => {
      link.classList.toggle(
        'active',
        link.dataset.page === pageId
      );
    });

    utils.showPage(pageId);

    if (pageId === 'gallery' && isLicenseVerified()) {
      renderGallery();
    }

    if (pageId === 'likings' && isLicenseVerified()) {
      renderLikings();
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openPage(link.dataset.page);
    });
  });

  actionCards.forEach(card => {
    card.addEventListener('click', event => {
      event.preventDefault();
      openPage(card.dataset.page);
    });
  });

  const logo = document.querySelector('.nav-logo');

  if (logo) {
    logo.addEventListener('click', event => {
      event.preventDefault();
      openPage('home');
    });
  }

  updateProtectedVisibility();
};



// Verify License Page
const initVerifyPage = () => {
  const form = document.getElementById('verify-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cardId = document.getElementById('card-id').value.toUpperCase();
    const password = document.getElementById('password').value;

    const resultDiv = document.getElementById('verify-result');
    const license = licenseDatabase[cardId];

    if (license && password === license.password) {
      currentLicense = license;
      updateProtectedVisibility();
      loadLicenseImages();
      renderGallery();
      renderLikings();
      resultDiv.innerHTML = `
      <div class="glass-card" style="border-color:#4ade80;background:rgba(74,222,128,.1);text-align:center;">
      <h2 style="color:#16a34a;">✅ Verified Licence Successfully</h2>
      </div>
      `;
      resultDiv.classList.remove('hidden');
      form.reset();
      
    } else {
      currentLicense = null;
      updateProtectedVisibility();
      resultDiv.innerHTML = `
      <div class="glass-card" style="border-color:#ef4444;background:rgba(239,68,68,.1);text-align:center;">
      <h2 style="color:#dc2626;">❌ Can't verify The Licence</h2>
      </div>
      `;
      resultDiv.classList.remove('hidden');
    }
  });
};

// Load license images from folder
const loadLicenseImages = () => {
  if (!currentLicense) return;
  
  const frontImg = document.querySelector('.card-flip-front img');
  const backImg = document.querySelector('.card-flip-back img');
  
  if (frontImg) {
    frontImg.src = currentLicense.image_folder + '/front.png';
    frontImg.alt = `${currentLicense.license_number} - Front`;
  }
  if (backImg) {
    backImg.src = currentLicense.image_folder + '/back.png';
    backImg.alt = `${currentLicense.license_number} - Back`;
  }
};

// License Card Flip
const initCardFlip = () => {
  const container = document.querySelector('.card-flip-container');

  if (container) {
    container.addEventListener('click', function () {
      if (!isLicenseVerified()) {
        alert('Please verify your card ID first.');
        utils.showPage('verify');
        return;
      }

      this.classList.toggle('flipped');
    });
  }
};

// Gallery Page
const renderGallery = () => {
  const galleryGrid = document.getElementById('gallery-grid');
  if (!galleryGrid) return;

  if (!isLicenseVerified()) {
    galleryGrid.innerHTML = '';
    return;
  }

  const images = storage.gallery.get();

  galleryGrid.innerHTML = images.map(img => `
    <div class="gallery-item">
      <img src="${img.data}" alt="${img.name}">
      <div class="gallery-item-overlay">
        <button
          class="gallery-item-btn"
          onclick="downloadImage('${img.id}')"
          title="Download"
        >
          ⬇️
        </button>

        <button
          class="gallery-item-btn"
          onclick="deleteImage('${img.id}')"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  `).join('');
};


const initGallery = () => {
  const fileInput = document.getElementById('gallery-file-input');
  const fileLabel = document.querySelector('.file-input-label');
  const galleryGrid = document.getElementById('gallery-grid');

  if (!fileLabel) return;

  fileLabel.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        storage.gallery.add({
          data: event.target.result,
          name: file.name,
          date: new Date().toLocaleDateString(),
        });
        fileInput.value = '';
      };
      reader.readAsDataURL(file);
    }
  });

  const renderGallery = () => {
    const images = storage.gallery.get();
    if (!galleryGrid) return;
    
    galleryGrid.innerHTML = images.map(img => `
      <div class="gallery-item">
        <img src="${img.data}" alt="${img.name}">
        <div class="gallery-item-overlay">
          <button class="gallery-item-btn" onclick="downloadImage('${img.id}')" title="Download">⬇️</button>
          <button class="gallery-item-btn" onclick="deleteImage('${img.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  };

  window.downloadImage = (id) => {
    const images = storage.gallery.get();
    const image = images.find(img => img.id === id);
    if (image) {
      const link = document.createElement('a');
      link.href = image.data;
      link.download = image.name || 'friendship-memory.png';
      link.click();
    }
  };

  window.deleteImage = (id) => {
    if (confirm('Delete this memory?')) {
      storage.gallery.remove(id);
      renderGallery();
    }
  };

  renderGallery();
};

// Likings Page
const renderLikings = () => {
  const likingsContainer = document.getElementById('likings-container');
  if (!likingsContainer) return;

  if (!isLicenseVerified()) {
    likingsContainer.innerHTML = '';
    return;
  }

  const data = storage.likings.get();

  likingsContainer.innerHTML = Object.entries(data).map(
    ([category, items]) => `
      <div class="category">
        <div class="category-header">
          <div class="category-title">${category}</div>

          <button
            class="btn btn-secondary"
            onclick="addLiking('${category}')"
          >
            + Add
          </button>
        </div>

        <div class="category-items">
          ${items.map((item, index) => `
            <div class="category-tag">
              ${item}

              <button
                class="tag-remove-btn"
                onclick="removeLiking('${category}', ${index})"
              >
                ×
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `
  ).join('');
};


const initLikings = () => {
  const likingsContainer = document.getElementById('likings-container');
  if (!likingsContainer) return;

  const renderLikings = () => {
    const data = storage.likings.get();
    likingsContainer.innerHTML = Object.entries(data).map(([category, items]) => `
      <div class="category">
        <div class="category-header">
          <div class="category-title">${category}</div>
          <button class="btn btn-secondary" onclick="addLiking('${category}')">+ Add</button>
        </div>
        <div class="category-items" id="items-${category}">
          ${items.map((item, idx) => `
            <div class="category-tag">
              ${item}
              <button class="tag-remove-btn" onclick="removeLiking('${category}', ${idx})">×</button>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  };

  window.addLiking = (category) => {
    const item = prompt(`Add new item to ${category}:`);
    if (item && item.trim()) {
      const data = storage.likings.get();
      if (!data[category]) data[category] = [];
      data[category].push(item.trim());
      storage.likings.set(data);
    }
  };

  window.removeLiking = (category, index) => {
    const data = storage.likings.get();
    data[category].splice(index, 1);
    storage.likings.set(data);
    renderLikings();
  };

  renderLikings();
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initVerifyPage();
  initCardFlip();
  initGallery();
  initLikings();
  floatingHearts();

  // Set home page as active on load
  const homeLink = document.querySelector('[data-page="home"]');
  if (homeLink) homeLink.classList.add('active');
});

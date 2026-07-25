// ============================================================
// FRIENDSHIP LICENSE PORTAL
// Cross-device image gallery:
//   - Cloudinary stores image files
//   - Firebase Realtime Database stores image URLs by licence ID
//   - GitHub Pages continues hosting the website
// ============================================================

// --------------------------
// 1. CLOUD CONFIGURATION
// --------------------------
// Replace these three placeholders after following SETUP-GUIDE.txt.
const CLOUDINARY_CLOUD_NAME = 'ixyynoop';
const CLOUDINARY_UPLOAD_PRESET = "friendship_gallery";';

// Do not add a trailing slash.
// Example: https://your-project-default-rtdb.firebaseio.com
const FIREBASE_DATABASE_URL =
  'https://friendship-licence-default-rtdb.firebaseio.com';

// Protected pages require a verified licence.
const protectedPages = ['license', 'gallery', 'likings'];

// Utility functions
const utils = {
  showPage(pageId) {
    document.querySelectorAll('main > [data-page]').forEach((page) => {
      page.classList.add('hidden');
    });

    const page = document.getElementById(pageId);
    if (page) page.classList.remove('hidden');
  },

  createElement(tag, className = '', innerHTML = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
  },

  generateId() {
    return `_${Math.random().toString(36).slice(2, 11)}`;
  },

  escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },

  isConfigured() {
    return (
      !CLOUDINARY_CLOUD_NAME.startsWith('CLOUDINARY_CLOUD_NAME') &&
      !CLOUDINARY_UPLOAD_PRESET.startsWith('CLOUDINARY_UPLOAD_PRESET') &&
      !FIREBASE_DATABASE_URL.includes('friendship-licence')
    );
  },
};

// ------------------------------------------------------------
// 2. LICENCE DATABASE
// Add or edit your licences here.
// Passwords inside public JavaScript are visible to visitors.
// This is suitable for a fun project, not high-security access.
// ------------------------------------------------------------
const licenseDatabase = {
  'FL-0210001': {
    license_number: 'FL-0210001',
    friends_1: 'Bestie #1',
    friends_2: 'Bestie #2',
    issued_date: '01/15/2026',
    expiry_date: '01/15/2027',
    certification_code: 'BFF-CERT-2026-001',
    license_status: 'ACTIVE',
    verified: true,
    password: 'bestie123',
    image_folder: 'licenses/FL-0210001',
  },

  'FL-0210002': {
    license_number: 'FL-0210002',
    friends_1: 'Friend A',
    friends_2: 'Friend B',
    issued_date: '02/20/2026',
    expiry_date: '02/20/2027',
    certification_code: 'BFF-CERT-2026-002',
    license_status: 'ACTIVE',
    verified: true,
    password: 'bestfriends',
    image_folder: 'licenses/FL-0210002',
  },
};

let currentLicense = null;
let galleryImages = [];
let galleryBusy = false;

// ------------------------------------------------------------
// 3. FIREBASE REST HELPERS
// ------------------------------------------------------------
function firebaseGalleryUrl(cardId, child = '') {
  const safeCardId = encodeURIComponent(cardId);
  const suffix = child ? `/${encodeURIComponent(child)}` : '';
  return `${FIREBASE_DATABASE_URL}/galleries/${safeCardId}${suffix}.json`;
}

async function readGalleryFromFirebase(cardId) {
  const response = await fetch(firebaseGalleryUrl(cardId), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Firebase read failed (${response.status})`);
  }

  const data = await response.json();

  if (!data) return [];

  return Object.entries(data)
    .map(([id, image]) => ({ id, ...image }))
    .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0));
}

async function saveGalleryImageToFirebase(cardId, image) {
  const response = await fetch(firebaseGalleryUrl(cardId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(image),
  });

  if (!response.ok) {
    throw new Error(`Firebase save failed (${response.status})`);
  }

  const result = await response.json();
  return result.name;
}

async function removeGalleryImageFromFirebase(cardId, firebaseId) {
  const response = await fetch(firebaseGalleryUrl(cardId, firebaseId), {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Firebase delete failed (${response.status})`);
  }
}

// ------------------------------------------------------------
// 4. CLOUDINARY UPLOAD
// ------------------------------------------------------------
async function uploadImageToCloudinary(file, cardId, onProgressText) {
  const uploadUrl =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  // This creates a separate Cloudinary folder for each licence.
  formData.append('folder', `friendship-gallery/${cardId}`);

  onProgressText?.('Uploading image…');

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    const message =
      result?.error?.message || `Cloudinary upload failed (${response.status})`;
    throw new Error(message);
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    name: file.name,
    format: result.format || '',
    width: result.width || null,
    height: result.height || null,
    bytes: result.bytes || file.size,
    uploadedAt: Date.now(),
  };
}

// ------------------------------------------------------------
// 5. LOCAL STORAGE — LIKINGS ONLY
// Images are no longer stored in localStorage.
// ------------------------------------------------------------
const storage = {
  likings: {
    get() {
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

    set(data) {
      const cardId = currentLicense?.license_number || 'default';
      localStorage.setItem(`likings_data_${cardId}`, JSON.stringify(data));
    },
  },
};

// ------------------------------------------------------------
// 6. PROTECTED ACCESS
// ------------------------------------------------------------
function isLicenseVerified() {
  return Boolean(currentLicense?.license_number);
}

function updateProtectedVisibility() {
  document.querySelectorAll('[data-page]').forEach((element) => {
    const pageId = element.dataset.page;
    if (!protectedPages.includes(pageId)) return;

    // Hide nav links/cards before verification, but not the actual main pages.
    if (!element.matches('main > [data-page]')) {
      element.classList.toggle('hidden', !isLicenseVerified());
    }
  });
}

function showVerificationRequired() {
  utils.showPage('verify');

  const resultDiv = document.getElementById('verify-result');
  if (!resultDiv) return;

  resultDiv.innerHTML = `
    <div class="glass-card"
         style="border-color:#ef4444;background:rgba(239,68,68,.1);text-align:center;">
      <h2 style="color:#dc2626;">Verify a Licence First</h2>
    </div>
  `;
  resultDiv.classList.remove('hidden');
}

// ------------------------------------------------------------
// 7. NAVIGATION
// ------------------------------------------------------------
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-links a[data-page]');
  const actionCards = document.querySelectorAll('.action-card[data-page]');

  async function openPage(pageId) {
    if (protectedPages.includes(pageId) && !isLicenseVerified()) {
      showVerificationRequired();
      return;
    }

    navLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    utils.showPage(pageId);

    if (pageId === 'gallery') {
      await refreshGallery();
    }
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      await openPage(link.dataset.page);
    });
  });

  actionCards.forEach((card) => {
    card.addEventListener('click', async (event) => {
      event.preventDefault();
      await openPage(card.dataset.page);
    });
  });

  const logo = document.querySelector('.nav-logo');
  logo?.addEventListener('click', (event) => {
    event.preventDefault();
    utils.showPage('home');
  });
}

// ------------------------------------------------------------
// 8. LICENCE VERIFICATION
// ------------------------------------------------------------
function initVerifyPage() {
  const form = document.getElementById('verify-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const cardId = document
      .getElementById('card-id')
      .value.trim()
      .toUpperCase();

    const password = document.getElementById('password').value;
    const resultDiv = document.getElementById('verify-result');
    const license = licenseDatabase[cardId];

    if (license && password === license.password) {
      currentLicense = license;
      galleryImages = [];

      resultDiv.innerHTML = `
        <div class="glass-card"
             style="border-color:#4ade80;background:rgba(74,222,128,.1);text-align:center;">
          <h2 style="color:#16a34a;">✅ Verified Licence Successfully</h2>
        </div>
      `;

      resultDiv.classList.remove('hidden');
      form.reset();

      updateProtectedVisibility();
      loadLicenseImages();
      renderLikings();
      await refreshGallery();
    } else {
      currentLicense = null;
      galleryImages = [];
      updateProtectedVisibility();

      resultDiv.innerHTML = `
        <div class="glass-card"
             style="border-color:#ef4444;background:rgba(239,68,68,.1);text-align:center;">
          <h2 style="color:#dc2626;">❌ Can't verify The Licence</h2>
        </div>
      `;

      resultDiv.classList.remove('hidden');
    }
  });
}

// ------------------------------------------------------------
// 9. LICENCE CARD
// ------------------------------------------------------------
function loadLicenseImages() {
  if (!currentLicense) return;

  const frontImg = document.querySelector('.card-flip-front img');
  const backImg = document.querySelector('.card-flip-back img');

  if (frontImg) {
    frontImg.src = `${currentLicense.image_folder}/front.png`;
    frontImg.alt = `${currentLicense.license_number} - Front`;
  }

  if (backImg) {
    backImg.src = `${currentLicense.image_folder}/back.png`;
    backImg.alt = `${currentLicense.license_number} - Back`;
  }
}

function initCardFlip() {
  const container = document.querySelector('.card-flip-container');

  container?.addEventListener('click', function () {
    if (!isLicenseVerified()) return;
    this.classList.toggle('flipped');
  });

  // Deliberately no automatic demo licence here.
}

// ------------------------------------------------------------
// 10. GALLERY
// ------------------------------------------------------------
function getGalleryGrid() {
  return document.getElementById('gallery-grid');
}

function setGalleryMessage(message, isError = false) {
  const grid = getGalleryGrid();
  if (!grid) return;

  grid.innerHTML = `
    <div class="glass-card"
         style="grid-column:1/-1;text-align:center;${
           isError ? 'border-color:#ef4444;' : ''
         }">
      <p>${utils.escapeHtml(message)}</p>
    </div>
  `;
}

function renderGallery() {
  const grid = getGalleryGrid();
  if (!grid) return;

  if (!isLicenseVerified()) {
    setGalleryMessage('Verify a licence to view its gallery.');
    return;
  }

  if (galleryImages.length === 0) {
    setGalleryMessage(
      `No memories uploaded yet for ${currentLicense.license_number}.`
    );
    return;
  }

  grid.innerHTML = galleryImages
    .map(
      (image) => `
        <div class="gallery-item">
          <img
            src="${utils.escapeHtml(image.url)}"
            alt="${utils.escapeHtml(image.name || 'Friendship memory')}"
            loading="lazy"
          >

          <div class="gallery-item-overlay">
            <button
              class="gallery-item-btn"
              onclick="downloadImage('${utils.escapeHtml(image.id)}')"
              title="Open image"
              type="button"
            >⬇️</button>

            <button
              class="gallery-item-btn"
              onclick="deleteImage('${utils.escapeHtml(image.id)}')"
              title="Remove from gallery"
              type="button"
            >🗑️</button>
          </div>
        </div>
      `
    )
    .join('');
}

async function refreshGallery() {
  if (!isLicenseVerified()) {
    galleryImages = [];
    renderGallery();
    return;
  }

  if (!utils.isConfigured()) {
    setGalleryMessage(
      'Cloud storage is not configured yet. Open SETUP-GUIDE.txt.',
      true
    );
    return;
  }

  setGalleryMessage('Loading memories…');

  try {
    galleryImages = await readGalleryFromFirebase(
      currentLicense.license_number
    );
    renderGallery();
  } catch (error) {
    console.error(error);
    setGalleryMessage(
      `Could not load images: ${error.message}`,
      true
    );
  }
}

function initGallery() {
  const fileInput = document.getElementById('gallery-file-input');
  const fileLabel = document.querySelector('.file-input-label');

  if (!fileInput || !fileLabel) return;

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    fileInput.value = '';

    if (!file) return;

    if (!isLicenseVerified()) {
      alert('Verify a licence before uploading an image.');
      return;
    }

    if (!utils.isConfigured()) {
      alert('Cloud storage is not configured. Follow SETUP-GUIDE.txt first.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const maximumBytes = 10 * 1024 * 1024;
    if (file.size > maximumBytes) {
      alert('The image must be smaller than 10 MB.');
      return;
    }

    if (galleryBusy) return;
    galleryBusy = true;

    const originalText = fileLabel.textContent;
    fileLabel.style.pointerEvents = 'none';
    fileLabel.style.opacity = '0.65';

    try {
      fileLabel.textContent = 'Uploading…';

      const cloudImage = await uploadImageToCloudinary(
        file,
        currentLicense.license_number,
        (text) => {
          fileLabel.textContent = text;
        }
      );

      fileLabel.textContent = 'Saving…';

      const firebaseId = await saveGalleryImageToFirebase(
        currentLicense.license_number,
        cloudImage
      );

      galleryImages.unshift({
        id: firebaseId,
        ...cloudImage,
      });

      renderGallery();
      alert('Image uploaded successfully. It is now visible on other devices.');
    } catch (error) {
      console.error(error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      galleryBusy = false;
      fileLabel.textContent = originalText || '+ Upload Memory';
      fileLabel.style.pointerEvents = '';
      fileLabel.style.opacity = '';
    }
  });

  window.downloadImage = (id) => {
    const image = galleryImages.find((item) => item.id === id);
    if (!image) return;

    // Opens the original Cloudinary image in a new tab.
    window.open(image.url, '_blank', 'noopener,noreferrer');
  };

  window.deleteImage = async (id) => {
    if (!isLicenseVerified()) return;

    const image = galleryImages.find((item) => item.id === id);
    if (!image) return;

    const confirmed = confirm(
      'Remove this memory from the gallery?\n\n' +
      'Note: this removes its Firebase record. The Cloudinary asset remains ' +
      'stored because permanent Cloudinary deletion requires a secret backend.'
    );

    if (!confirmed) return;

    try {
      await removeGalleryImageFromFirebase(
        currentLicense.license_number,
        id
      );

      galleryImages = galleryImages.filter((item) => item.id !== id);
      renderGallery();
    } catch (error) {
      console.error(error);
      alert(`Delete failed: ${error.message}`);
    }
  };

  renderGallery();
}

// ------------------------------------------------------------
// 11. LIKINGS — unchanged and still local per device
// ------------------------------------------------------------
function renderLikings() {
  const container = document.getElementById('likings-container');
  if (!container) return;

  if (!isLicenseVerified()) {
    container.innerHTML = '';
    return;
  }

  const data = storage.likings.get();

  container.innerHTML = Object.entries(data)
    .map(
      ([category, items]) => `
        <div class="category">
          <div class="category-header">
            <div class="category-title">${utils.escapeHtml(category)}</div>
            <button
              class="btn btn-secondary"
              onclick="addLiking('${utils.escapeHtml(category)}')"
              type="button"
            >+ Add</button>
          </div>

          <div class="category-items">
            ${items
              .map(
                (item, index) => `
                  <div class="category-tag">
                    ${utils.escapeHtml(item)}
                    <button
                      class="tag-remove-btn"
                      onclick="removeLiking('${utils.escapeHtml(category)}', ${index})"
                      type="button"
                    >×</button>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `
    )
    .join('');
}

function initLikings() {
  window.addLiking = (category) => {
    if (!isLicenseVerified()) return;

    const item = prompt(`Add new item to ${category}:`);

    if (item?.trim()) {
      const data = storage.likings.get();
      if (!data[category]) data[category] = [];
      data[category].push(item.trim());
      storage.likings.set(data);
      renderLikings();
    }
  };

  window.removeLiking = (category, index) => {
    if (!isLicenseVerified()) return;

    const data = storage.likings.get();
    data[category]?.splice(index, 1);
    storage.likings.set(data);
    renderLikings();
  };

  renderLikings();
}

// ------------------------------------------------------------
// 12. DECORATION
// ------------------------------------------------------------
function floatingHearts() {
  const container = document.querySelector('.floating-hearts');
  if (!container) return;

  const createHeart = () => {
    const heart = utils.createElement('div', 'heart', '♡');

    heart.style.left = `${Math.random() * window.innerWidth}px`;
    heart.style.top = `${window.innerHeight}px`;
    heart.style.color = ['#ff9dcb', '#ffd6e8', '#e8d5f2', '#ffd1b8'][
      Math.floor(Math.random() * 4)
    ];

    container.appendChild(heart);
    setTimeout(() => heart.remove(), 2000);
  };

  setInterval(createHeart, 800);
}

// ------------------------------------------------------------
// 13. START APPLICATION
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  currentLicense = null;
  galleryImages = [];

  initNavigation();
  initVerifyPage();
  initCardFlip();
  initGallery();
  initLikings();
  floatingHearts();

  updateProtectedVisibility();
  utils.showPage('home');
});

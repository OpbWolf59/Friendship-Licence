// ============================================================
// FRIENDSHIP LICENSE PORTAL
// Cloudinary = image storage
// Firebase Realtime Database = image URL storage
// ============================================================

// ------------------------------------------------------------
// 1. CLOUD CONFIGURATION
// ------------------------------------------------------------
const CLOUDINARY_CLOUD_NAME = 'ixyynoop';
const CLOUDINARY_UPLOAD_PRESET = 'friendship_gallery';

const FIREBASE_DATABASE_URL =
  'https://friendship-licence-default-rtdb.firebaseio.com';

// These pages remain hidden until a licence is verified.
const protectedPages = ['license', 'gallery', 'likings'];

// ------------------------------------------------------------
// 2. LICENCE DATABASE
// ------------------------------------------------------------
const licenseDatabase = {
  'FL-0210001': {
    license_number: 'FL-0210001',
    friends_1: 'Vibhushi',
    friends_2: 'Abhinav',
    issued_date: '07/25/2026',
    expiry_date: 'Never',
    certification_code: 'BFF-CERT-2026-001',
    license_status: 'ACTIVE',
    password: 'FL-0210001',
    image_folder: 'licenses/FL-0210001',
  },

  'FL-0210002': {
    license_number: 'FL-0210002',
    friends_1: 'Mahi',
    friends_2: 'Abhinav',
    issued_date: '07/25/2026',
    expiry_date: 'Never',
    certification_code: 'BFF-CERT-2026-002',
    license_status: 'ACTIVE',
    password: 'FL-0210002',
    image_folder: 'licenses/FL-0210002',
  },
};
'FL-0210003': {
    license_number: 'FL-0210003',
    friends_1: 'Urvi',
    friends_2: 'Abhinav',
    issued_date: '07/25/2026',
    expiry_date: 'Never',
    certification_code: 'BFF-CERT-2026-003',
    license_status: 'ACTIVE',
    password: 'FL-0210003',
    image_folder: 'licenses/FL-0210003',
  },
};

let currentLicense = null;
let galleryImages = [];
let galleryBusy = false;

// ------------------------------------------------------------
// 3. UTILITIES
// ------------------------------------------------------------
const utils = {
  showPage(pageId) {
    document.querySelectorAll('main > [data-page]').forEach((page) => {
      page.classList.toggle('hidden', page.id !== pageId);
    });

    document.querySelectorAll('.nav-links a[data-page]').forEach((link) => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    if (window.location.hash !== `#${pageId}`) {
      history.replaceState(null, '', `#${pageId}`);
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  },

  createElement(tag, className = '', innerHTML = '') {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (innerHTML) {
      element.innerHTML = innerHTML;
    }

    return element;
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
    return Boolean(
      CLOUDINARY_CLOUD_NAME &&
        CLOUDINARY_UPLOAD_PRESET &&
        FIREBASE_DATABASE_URL &&
        !CLOUDINARY_CLOUD_NAME.startsWith('YOUR_') &&
        !CLOUDINARY_UPLOAD_PRESET.startsWith('YOUR_') &&
        !FIREBASE_DATABASE_URL.includes('YOUR_PROJECT_ID')
    );
  },
};

function isLicenseVerified() {
  return Boolean(currentLicense?.license_number);
}

// ------------------------------------------------------------
// 4. FIREBASE FUNCTIONS
// ------------------------------------------------------------
function firebaseGalleryUrl(cardId, child = '') {
  const safeCardId = encodeURIComponent(cardId);
  const childPath = child ? `/${encodeURIComponent(child)}` : '';

  return `${FIREBASE_DATABASE_URL}/galleries/${safeCardId}${childPath}.json`;
}

async function readGalleryFromFirebase(cardId) {
  const response = await fetch(firebaseGalleryUrl(cardId), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Firebase read failed (${response.status})${
        responseText ? `: ${responseText}` : ''
      }`
    );
  }

  const data = await response.json();

  if (!data) {
    return [];
  }

  return Object.entries(data)
    .map(([id, image]) => ({
      id,
      ...image,
    }))
    .sort(
      (firstImage, secondImage) =>
        Number(secondImage.uploadedAt || 0) -
        Number(firstImage.uploadedAt || 0)
    );
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
    const responseText = await response.text();

    throw new Error(
      `Firebase save failed (${response.status})${
        responseText ? `: ${responseText}` : ''
      }`
    );
  }

  const result = await response.json();

  if (!result?.name) {
    throw new Error('Firebase did not return an image record ID.');
  }

  return result.name;
}

async function removeGalleryImageFromFirebase(cardId, firebaseId) {
  const response = await fetch(
    firebaseGalleryUrl(cardId, firebaseId),
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Firebase delete failed (${response.status})${
        responseText ? `: ${responseText}` : ''
      }`
    );
  }
}

// ------------------------------------------------------------
// 5. CLOUDINARY UPLOAD
// ------------------------------------------------------------
async function uploadImageToCloudinary(
  file,
  cardId,
  updateProgressText
) {
  const uploadUrl =
    `https://api.cloudinary.com/v1_1/` +
    `${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/image/upload`;

  const formData = new FormData();

  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `friendship-gallery/${cardId}`);

  updateProgressText?.('Uploading image…');

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Cloudinary returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
        `Cloudinary upload failed (${response.status}).`
    );
  }

  if (!result.secure_url) {
    throw new Error(
      'Cloudinary uploaded the image but did not return an image URL.'
    );
  }

  return {
    url: result.secure_url,
    publicId: result.public_id || '',
    name: file.name,
    format: result.format || '',
    width: result.width || null,
    height: result.height || null,
    bytes: result.bytes || file.size,
    uploadedAt: Date.now(),
  };
}

// ------------------------------------------------------------
// 6. PROTECTED PAGE VISIBILITY
// ------------------------------------------------------------
function updateProtectedVisibility() {
  document
    .querySelectorAll(
      '.nav-links a[data-page], .action-card[data-page]'
    )
    .forEach((element) => {
      const pageId = element.dataset.page;

      if (!protectedPages.includes(pageId)) {
        return;
      }

      element.classList.toggle(
        'hidden',
        !isLicenseVerified()
      );
    });
}

function showVerificationRequired() {
  utils.showPage('verify');

  const resultDiv = document.getElementById('verify-result');

  if (!resultDiv) {
    return;
  }

  resultDiv.innerHTML = `
    <div
      class="glass-card"
      style="
        border-color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
        text-align: center;
      "
    >
      <h2 style="color: #dc2626;">
        Verify a Licence First
      </h2>
    </div>
  `;

  resultDiv.classList.remove('hidden');
}

// ------------------------------------------------------------
// 7. NAVIGATION
// ------------------------------------------------------------
async function openPage(pageId) {
  const page = document.getElementById(pageId);

  if (!page || !page.matches('main > [data-page]')) {
    utils.showPage('home');
    return;
  }

  if (
    protectedPages.includes(pageId) &&
    !isLicenseVerified()
  ) {
    showVerificationRequired();
    return;
  }

  utils.showPage(pageId);

  if (pageId === 'gallery') {
    await refreshGallery();
  }

  if (pageId === 'likings') {
    renderLikings();
  }

  if (pageId === 'license') {
    loadLicenseImages();
  }
}

function initNavigation() {
  const clickableItems = document.querySelectorAll(
    '.nav-links a[data-page], .action-card[data-page]'
  );

  clickableItems.forEach((item) => {
    item.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      await openPage(item.dataset.page);
    });
  });

  const logo = document.querySelector('.nav-logo');

  logo?.addEventListener('click', async (event) => {
    event.preventDefault();

    await openPage('home');
  });

  window.addEventListener('hashchange', async () => {
    const requestedPage =
      window.location.hash.replace('#', '').trim() || 'home';

    await openPage(requestedPage);
  });
}

// ------------------------------------------------------------
// 8. LICENCE VERIFICATION
// ------------------------------------------------------------
function initVerifyPage() {
  const form = document.getElementById('verify-form');
  const cardIdInput = document.getElementById('card-id');
  const passwordInput = document.getElementById('password');
  const resultDiv = document.getElementById('verify-result');

  if (
    !form ||
    !cardIdInput ||
    !passwordInput ||
    !resultDiv
  ) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const cardId = cardIdInput.value
      .trim()
      .toUpperCase();

    const password = passwordInput.value;
    const license = licenseDatabase[cardId];

    if (license && password === license.password) {
      currentLicense = license;
      galleryImages = [];

      resultDiv.innerHTML = `
        <div
          class="glass-card"
          style="
            border-color: #4ade80;
            background: rgba(74, 222, 128, 0.1);
            text-align: center;
          "
        >
          <h2 style="color: #16a34a;">
            ✅ Verified Licence Successfully
          </h2>

          <p style="margin-top: 0.75rem;">
            ${utils.escapeHtml(currentLicense.license_number)}
          </p>
        </div>
      `;

      resultDiv.classList.remove('hidden');

      form.reset();

      updateProtectedVisibility();
      loadLicenseImages();
      renderLikings();

      await refreshGallery();

      return;
    }

    currentLicense = null;
    galleryImages = [];

    updateProtectedVisibility();

    resultDiv.innerHTML = `
      <div
        class="glass-card"
        style="
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          text-align: center;
        "
      >
        <h2 style="color: #dc2626;">
          ❌ Can't verify The Licence
        </h2>
      </div>
    `;

    resultDiv.classList.remove('hidden');
  });
}

// ------------------------------------------------------------
// 9. LICENCE CARD
// ------------------------------------------------------------
function loadLicenseImages() {
  if (!currentLicense) {
    return;
  }

  const frontImage = document.querySelector(
    '.card-flip-front img'
  );

  const backImage = document.querySelector(
    '.card-flip-back img'
  );

  if (frontImage) {
    frontImage.src =
      `${currentLicense.image_folder}/front.png`;

    frontImage.alt =
      `${currentLicense.license_number} - Licence Front`;
  }

  if (backImage) {
    backImage.src =
      `${currentLicense.image_folder}/back.png`;

    backImage.alt =
      `${currentLicense.license_number} - Licence Back`;
  }

  document
    .querySelector('.card-flip-container')
    ?.classList.remove('flipped');
}

function initCardFlip() {
  const cardContainer = document.querySelector(
    '.card-flip-container'
  );

  cardContainer?.addEventListener('click', () => {
    if (!isLicenseVerified()) {
      showVerificationRequired();
      return;
    }

    cardContainer.classList.toggle('flipped');
  });
}

// ------------------------------------------------------------
// 10. GALLERY
// ------------------------------------------------------------
function getGalleryGrid() {
  return document.getElementById('gallery-grid');
}

function setGalleryMessage(message, isError = false) {
  const galleryGrid = getGalleryGrid();

  if (!galleryGrid) {
    return;
  }

  galleryGrid.innerHTML = `
    <div
      class="glass-card"
      style="
        grid-column: 1 / -1;
        text-align: center;
        ${isError ? 'border-color: #ef4444;' : ''}
      "
    >
      <p>${utils.escapeHtml(message)}</p>
    </div>
  `;
}

function renderGallery() {
  const galleryGrid = getGalleryGrid();

  if (!galleryGrid) {
    return;
  }

  if (!isLicenseVerified()) {
    setGalleryMessage(
      'Verify a licence to view its gallery.'
    );

    return;
  }

  if (galleryImages.length === 0) {
    setGalleryMessage(
      `No memories uploaded yet for ` +
        `${currentLicense.license_number}.`
    );

    return;
  }

  galleryGrid.innerHTML = galleryImages
    .map((image) => {
      const imageId = utils.escapeHtml(image.id);
      const imageUrl = utils.escapeHtml(image.url);

      const imageName = utils.escapeHtml(
        image.name || 'Friendship memory'
      );

      return `
        <div class="gallery-item">
          <img
            src="${imageUrl}"
            alt="${imageName}"
            loading="lazy"
          >

          <div class="gallery-item-overlay">
            <button
              class="gallery-item-btn"
              type="button"
              title="Open image"
              data-open-image="${imageId}"
            >
              ⬇️
            </button>

            <button
              class="gallery-item-btn"
              type="button"
              title="Remove image"
              data-delete-image="${imageId}"
            >
              🗑️
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  galleryGrid
    .querySelectorAll('[data-open-image]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        openGalleryImage(button.dataset.openImage);
      });
    });

  galleryGrid
    .querySelectorAll('[data-delete-image]')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        await deleteGalleryImage(
          button.dataset.deleteImage
        );
      });
    });
}

async function refreshGallery() {
  if (!isLicenseVerified()) {
    galleryImages = [];
    renderGallery();
    return;
  }

  if (!utils.isConfigured()) {
    setGalleryMessage(
      'Cloud storage is not configured correctly.',
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

function openGalleryImage(imageId) {
  const image = galleryImages.find(
    (galleryImage) => galleryImage.id === imageId
  );

  if (!image?.url) {
    return;
  }

  window.open(
    image.url,
    '_blank',
    'noopener,noreferrer'
  );
}

async function deleteGalleryImage(imageId) {
  if (!isLicenseVerified()) {
    return;
  }

  const image = galleryImages.find(
    (galleryImage) => galleryImage.id === imageId
  );

  if (!image) {
    return;
  }

  const confirmed = window.confirm(
    'Remove this memory from the gallery?\n\n' +
      'This removes its Firebase record. ' +
      'The Cloudinary image file remains stored.'
  );

  if (!confirmed) {
    return;
  }

  try {
    await removeGalleryImageFromFirebase(
      currentLicense.license_number,
      imageId
    );

    galleryImages = galleryImages.filter(
      (galleryImage) => galleryImage.id !== imageId
    );

    renderGallery();
  } catch (error) {
    console.error(error);

    alert(`Delete failed: ${error.message}`);
  }
}

function initGallery() {
  const fileInput = document.getElementById(
    'gallery-file-input'
  );

  const fileLabel = document.querySelector(
    '.file-input-label'
  );

  if (!fileInput || !fileLabel) {
    return;
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];

    fileInput.value = '';

    if (!file) {
      return;
    }

    if (!isLicenseVerified()) {
      showVerificationRequired();
      return;
    }

    if (!utils.isConfigured()) {
      alert(
        'Cloud storage is not configured correctly.'
      );

      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const maximumFileSize = 10 * 1024 * 1024;

    if (file.size > maximumFileSize) {
      alert('The image must be smaller than 10 MB.');
      return;
    }

    if (galleryBusy) {
      return;
    }

    galleryBusy = true;

    const originalText =
      fileLabel.textContent?.trim() ||
      '+ Upload Memory';

    fileLabel.style.pointerEvents = 'none';
    fileLabel.style.opacity = '0.65';

    try {
      fileLabel.textContent = 'Uploading…';

      const cloudImage =
        await uploadImageToCloudinary(
          file,
          currentLicense.license_number,
          (text) => {
            fileLabel.textContent = text;
          }
        );

      fileLabel.textContent = 'Saving…';

      const firebaseId =
        await saveGalleryImageToFirebase(
          currentLicense.license_number,
          cloudImage
        );

      galleryImages.unshift({
        id: firebaseId,
        ...cloudImage,
      });

      renderGallery();

      alert(
        'Image uploaded successfully. ' +
          'It is now visible on other devices.'
      );
    } catch (error) {
      console.error(error);

      alert(`Upload failed: ${error.message}`);
    } finally {
      galleryBusy = false;

      fileLabel.textContent = originalText;
      fileLabel.style.pointerEvents = '';
      fileLabel.style.opacity = '';
    }
  });

  renderGallery();
}

// ------------------------------------------------------------
// 11. LIKINGS
// ------------------------------------------------------------
const storage = {
  getLikings() {
    const cardId =
      currentLicense?.license_number || 'default';

    const defaultLikings = {
      'Favorite Foods': [
        'Pizza',
        'Sushi',
        'Tacos',
      ],

      'Favorite Movies': [
        'Spirited Away',
        'Your Name',
        'A Silent Voice',
      ],

      'Favorite Places': [
        'Café',
        'Beach',
        'Park',
      ],

      'Favorite Colors': [
        'Pink',
        'Lavender',
        'Peach',
      ],
    };

    try {
      const savedData = localStorage.getItem(
        `likings_data_${cardId}`
      );

      return savedData
        ? JSON.parse(savedData)
        : defaultLikings;
    } catch (error) {
      console.error(
        'Could not read likings:',
        error
      );

      return defaultLikings;
    }
  },

  setLikings(data) {
    const cardId =
      currentLicense?.license_number || 'default';

    localStorage.setItem(
      `likings_data_${cardId}`,
      JSON.stringify(data)
    );
  },
};

function renderLikings() {
  const container = document.getElementById(
    'likings-container'
  );

  if (!container) {
    return;
  }

  if (!isLicenseVerified()) {
    container.innerHTML = '';
    return;
  }

  const likingsData = storage.getLikings();

  container.innerHTML = Object.entries(likingsData)
    .map(([category, items]) => {
      const safeCategory =
        utils.escapeHtml(category);

      return `
        <div class="category">
          <div class="category-header">
            <div class="category-title">
              ${safeCategory}
            </div>

            <button
              class="btn btn-secondary"
              type="button"
              data-add-liking="${safeCategory}"
            >
              + Add
            </button>
          </div>

          <div class="category-items">
            ${items
              .map(
                (item, index) => `
                  <div class="category-tag">
                    ${utils.escapeHtml(item)}

                    <button
                      class="tag-remove-btn"
                      type="button"
                      data-remove-category="${safeCategory}"
                      data-remove-index="${index}"
                    >
                      ×
                    </button>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');

  container
    .querySelectorAll('[data-add-liking]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        addLiking(button.dataset.addLiking);
      });
    });

  container
    .querySelectorAll('[data-remove-category]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        removeLiking(
          button.dataset.removeCategory,
          Number(button.dataset.removeIndex)
        );
      });
    });
}

function addLiking(category) {
  if (!isLicenseVerified()) {
    return;
  }

  const item = prompt(
    `Add new item to ${category}:`
  );

  if (!item?.trim()) {
    return;
  }

  const likingsData = storage.getLikings();

  if (!Array.isArray(likingsData[category])) {
    likingsData[category] = [];
  }

  likingsData[category].push(item.trim());

  storage.setLikings(likingsData);
  renderLikings();
}

function removeLiking(category, index) {
  if (!isLicenseVerified()) {
    return;
  }

  const likingsData = storage.getLikings();

  if (!Array.isArray(likingsData[category])) {
    return;
  }

  likingsData[category].splice(index, 1);

  storage.setLikings(likingsData);
  renderLikings();
}

// ------------------------------------------------------------
// 12. FLOATING HEARTS
// ------------------------------------------------------------
function floatingHearts() {
  const container = document.querySelector(
    '.floating-hearts'
  );

  if (!container) {
    return;
  }

  const colors = [
    '#ff9dcb',
    '#ffd6e8',
    '#e8d5f2',
    '#ffd1b8',
  ];

  setInterval(() => {
    const heart = utils.createElement(
      'div',
      'heart',
      '♡'
    );

    heart.style.left =
      `${Math.random() * window.innerWidth}px`;

    heart.style.top =
      `${window.innerHeight}px`;

    heart.style.color =
      colors[
        Math.floor(Math.random() * colors.length)
      ];

    container.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 2000);
  }, 800);
}

// ------------------------------------------------------------
// 13. START APPLICATION
// ------------------------------------------------------------
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    currentLicense = null;
    galleryImages = [];

    initNavigation();
    initVerifyPage();
    initCardFlip();
    initGallery();
    floatingHearts();

    updateProtectedVisibility();

    const requestedPage =
      window.location.hash
        .replace('#', '')
        .trim() || 'home';

    await openPage(requestedPage);
  }
);

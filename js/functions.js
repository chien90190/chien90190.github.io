// Author linking
const authorLinks = {
  "Yu-Lun Liu": "https://yulunalexliu.github.io/",
  "Yi-Chuan Huang": "https://yichuanh.github.io/Personal-Page/",
  "Chung-Ho Wu": "https://kkennethwu.github.io/",
  "Chin-Yang Lin": "https://linjohnss.github.io/",
  "Wei-Lun Chao": "https://sites.google.com/view/wei-lun-harry-chao",
  "Jiewen Chan": "https://jiewenchan.github.io/"

};

function linkAuthors() {
  document.querySelectorAll('.pub-meta').forEach(meta => {
    let html = meta.innerHTML;
    Object.keys(authorLinks).forEach(name => {
      const regex = new RegExp(name, 'g');
      html = html.replace(regex, `<a href="${authorLinks[name]}" target="_blank" rel="noopener">${name}</a>`);
    });
    meta.innerHTML = html;
  });
}


// Update footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const html = document.documentElement;

const currentTheme = localStorage.getItem('theme') || 
  (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

if (currentTheme === 'light') {
  html.setAttribute('data-theme', 'light');
  sunIcon.style.display = 'none';
  moonIcon.style.display = 'block';
}

themeToggle.addEventListener('click', () => {
  const isLight = html.getAttribute('data-theme') === 'light';
  
  if (isLight) {
    html.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  } else {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  }
});

// Video hover effects
document.querySelectorAll('.pub-media').forEach(video => {
  video.addEventListener('mouseenter', () => {
    video.play();
  });
  
  video.addEventListener('mouseleave', () => {
    video.pause();
    video.currentTime = 0;
  });
});

// Copy email function
function copyEmail(event) {
  event.preventDefault();
  const email = 'hjchien90190@nycu.edu.tw';
  navigator.clipboard.writeText(email).then(() => {
    const badge = document.getElementById('email-badge');
    const icon = badge.querySelector('.copy-icon');
    const originalIcon = icon.outerHTML;
    
    icon.outerHTML = '<span style="font-size: 14px;">✓</span>';
    
    setTimeout(() => {
      badge.querySelector('span').outerHTML = originalIcon;
    }, 500);
  });
}

// Toggle publications
function togglePublications() {
  const morePubs = document.getElementById('more-pubs');
  const btn = document.getElementById('toggle-pubs-btn');
  
  if (morePubs.classList.contains('hidden')) {
    morePubs.classList.remove('hidden');
    btn.textContent = 'Show Less Publications ↑';
  } else {
    morePubs.classList.add('hidden');
    btn.textContent = 'Show More Publications ↓';
  }
}

// Call linkAuthors when page loads
linkAuthors();

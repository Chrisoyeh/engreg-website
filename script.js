/**
 * Engreg Schools Landing Page Scripts
 * Includes: Sticky Nav, Mobile Menu Collapse, Anthem Video controls, Event countdowns, Form validations, Scroll Reveal, Back-to-Top
 */

document.addEventListener("DOMContentLoaded", () => {
  
  /* ==========================================================================
     1. Sticky Navbar Scroll Effect & Active Highlight
     ========================================================================== */
  const navbar = document.getElementById("mainNavbar");
  const handleScroll = () => {
    if (window.scrollY > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  };
  
  window.addEventListener("scroll", handleScroll);
  handleScroll(); // Trigger on load in case page is refreshed while scrolled down

  // Close mobile navbar on link/item click (improves mobile UX)
  const navLinks = document.querySelectorAll("#mainNavbar .nav-link:not(.dropdown-toggle), #mainNavbar .dropdown-item");
  const navbarCollapse = document.getElementById("navbarContent");
  const bsCollapse = new bootstrap.Collapse(navbarCollapse, { toggle: false });
  
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      // Check if hamburger menu is open
      if (navbarCollapse.classList.contains("show")) {
        bsCollapse.hide();
      }
    });
  });

  /* ==========================================================================
     2. School Anthem Custom Video Player
     ========================================================================== */
  const video = document.getElementById("anthemVideo");
  const videoOverlay = document.getElementById("videoOverlay");
  const playBtn = document.getElementById("playBtn");
  const videoControls = document.getElementById("videoControls");
  const playPauseToggle = document.getElementById("videoPlayPause");
  const progressBar = document.getElementById("videoProgressBar");
  const progressFilled = document.getElementById("videoProgress");
  const fullscreenBtn = document.getElementById("videoFullscreen");

  if (video && videoOverlay && playBtn && videoControls && playPauseToggle && progressBar && progressFilled && fullscreenBtn) {
    // Play video on overlay click
    const playVideo = () => {
      video.play();
      videoOverlay.classList.add("fade-out");
      videoControls.classList.remove("d-none");
    };

    playBtn.addEventListener("click", playVideo);
    videoOverlay.addEventListener("click", playVideo);

    // Play/Pause toggle on click of the video screen itself
    video.addEventListener("click", () => {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    // Track play/pause state to update control icons
    video.addEventListener("play", () => {
      playPauseToggle.innerHTML = '<i class="fa-solid fa-pause"></i>';
      videoOverlay.classList.add("fade-out");
    });

    video.addEventListener("pause", () => {
      playPauseToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
    });

    playPauseToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    // Update progress bar
    video.addEventListener("timeupdate", () => {
      if (video.duration) {
        const percentage = (video.currentTime / video.duration) * 100;
        progressFilled.style.width = `${percentage}%`;
      }
    });

    // Scrubbing the video on progress bar click
    progressBar.addEventListener("click", (e) => {
      e.stopPropagation();
      const rect = progressBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      video.currentTime = pos * video.duration;
    });

    // Fullscreen support
    fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.webkitRequestFullscreen) { /* Safari */
        video.webkitRequestFullscreen();
      } else if (video.msRequestFullscreen) { /* IE11 */
        video.msRequestFullscreen();
      }
    });
  }

  /* ==========================================================================
     3. Events Countdown Timer & Floating Wristwatch
     ========================================================================== */
  const eventCards = document.querySelectorAll(".event-card");

  // Initialize targets dynamically to keep demo active and showcase countdown instantly
  const events = [];
  eventCards.forEach((card, index) => {
    const offsetDays = parseFloat(card.getAttribute("data-event-days"));
    const titleEl = card.querySelector(".event-title");
    const title = titleEl ? titleEl.textContent.trim() : "Upcoming Event";
    
    // We compute target date dynamically: current time + offsetDays (expressed in decimal e.g. 9 days, 8.5 days)
    const targetDate = new Date();
    targetDate.setTime(targetDate.getTime() + (offsetDays * 24 * 60 * 60 * 1000));
    
    const countdownEl = card.querySelector(".countdown-text");
    events.push({
      title: title,
      target: targetDate,
      element: countdownEl
    });
  });

  const watchEl = document.getElementById("eventWatch");
  const watchEventNameEl = document.getElementById("watchEventName");
  const watchDaysEl = document.getElementById("watchDays");
  const watchHoursEl = document.getElementById("watchHours");
  const watchMinutesEl = document.getElementById("watchMinutes");
  const watchSecondsEl = document.getElementById("watchSeconds");

  const updateCountdowns = () => {
    const now = new Date().getTime();
    
    // Update main page event cards countdowns
    events.forEach(eventObj => {
      const distance = eventObj.target.getTime() - now;
      
      if (distance < 0) {
        eventObj.element.textContent = "Event Started";
        return;
      }
      
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      const pad = (num) => String(num).padStart(2, "0");
      
      if (days < 10) {
        eventObj.element.innerHTML = `Event Starts In: <span class="text-accent">${pad(days)}</span> Days <span class="text-accent">${pad(hours)}</span> Hours <span class="text-accent">${pad(minutes)}</span> Minutes <span class="text-accent">${pad(seconds)}</span> Seconds`;
      } else {
        eventObj.element.innerHTML = `Starts In: <span class="text-accent">${days}</span> Days`;
      }
    });

    // Update Floating Wristwatch Countdown
    if (watchEl) {
      // Find the nearest upcoming future event
      const futureEvents = events
        .filter(eventObj => eventObj.target.getTime() > now)
        .sort((a, b) => a.target.getTime() - b.target.getTime());

      if (futureEvents.length === 0) {
        watchEl.style.display = "none";
        return;
      }

      watchEl.style.display = "flex";
      const nearestEvent = futureEvents[0];
      
      if (watchEventNameEl) {
        watchEventNameEl.textContent = nearestEvent.title;
      }

      const distance = nearestEvent.target.getTime() - now;
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      const pad = (num) => String(num).padStart(2, "0");

      if (watchDaysEl) watchDaysEl.textContent = pad(days);
      if (watchHoursEl) watchHoursEl.textContent = pad(hours);
      if (watchMinutesEl) watchMinutesEl.textContent = pad(minutes);
      if (watchSecondsEl) watchSecondsEl.textContent = pad(seconds);
    }
  };

  // Run countdown updates immediately and then every second
  updateCountdowns();
  setInterval(updateCountdowns, 1000);

  /* ==========================================================================
     4. Newsletter Section Validation & Notifications
     ========================================================================== */
  const newsletterForm = document.getElementById("newsletterForm");
  const newsletterSuccess = document.getElementById("newsletterSuccess");
  
  if (newsletterForm && newsletterSuccess) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const nameInput = document.getElementById("newsletterName");
      const emailInput = document.getElementById("newsletterEmail");
      
      let isValid = true;
      
      // Validate Name
      if (nameInput.value.trim() === "") {
        nameInput.classList.add("is-invalid");
        isValid = false;
      } else {
        nameInput.classList.remove("is-invalid");
        nameInput.classList.add("is-valid");
      }
      
      // Validate Email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value.trim())) {
        emailInput.classList.add("is-invalid");
        isValid = false;
      } else {
        emailInput.classList.remove("is-invalid");
        emailInput.classList.add("is-valid");
      }
      
      if (isValid) {
        // Clear form inputs
        nameInput.value = "";
        emailInput.value = "";
        nameInput.classList.remove("is-valid");
        emailInput.classList.remove("is-valid");
        
        // Hide form & show notification
        newsletterForm.classList.add("d-none");
        newsletterSuccess.classList.remove("d-none");
        
        // Reset back to show form after 6 seconds
        setTimeout(() => {
          newsletterSuccess.classList.add("d-none");
          newsletterForm.classList.remove("d-none");
        }, 6000);
      }
    });

    // Remove invalid state classes on input change
    document.getElementById("newsletterName").addEventListener("input", function() {
      this.classList.remove("is-invalid");
    });
    document.getElementById("newsletterEmail").addEventListener("input", function() {
      this.classList.remove("is-invalid");
    });
  }

  /* ==========================================================================
     5. Scroll-to-Top Button
     ========================================================================== */
  const scrollToTopBtn = document.getElementById("scrollToTop");
  
  window.addEventListener("scroll", () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop > 400) {
      scrollToTopBtn.style.display = "inline-flex";
    } else {
      scrollToTopBtn.style.display = "none";
    }
  });
  
  scrollToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  /* ==========================================================================
     6. Scroll Reveal Animations (Intersection Observer)
     ========================================================================== */
  const revealElements = document.querySelectorAll(".scroll-reveal");
  
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target); // Reveal animation occurs only once
      }
    });
  }, {
    threshold: 0.15, // trigger when 15% of element is in view
    rootMargin: "0px 0px -50px 0px"
  });
  
  revealElements.forEach(el => {
    revealObserver.observe(el);
  });
});

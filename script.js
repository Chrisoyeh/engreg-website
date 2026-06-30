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

  // Month string mapping to zero-indexed month integers
  const monthMap = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
  };

  // Initialize targets based on the actual static dates displayed on the cards
  const events = [];
  eventCards.forEach((card, index) => {
    const titleEl = card.querySelector(".event-title");
    const title = titleEl ? titleEl.textContent.trim() : "Upcoming Event";
    
    // Extract day and month from the HTML layout to sync countdown with display
    const dayEl = card.querySelector(".day");
    const monthEl = card.querySelector(".month");
    
    let targetDate;
    if (dayEl && monthEl) {
      const day = parseInt(dayEl.textContent.trim(), 10);
      const monthStr = monthEl.textContent.trim().toUpperCase();
      const month = monthMap[monthStr];
      
      const now = new Date();
      let year = now.getFullYear();
      
      // Assume event starts at 9:00 AM on the specified date
      targetDate = new Date(year, month, day, 9, 0, 0);
      
      // If target date in the current calendar year has already passed, use the next year
      if (targetDate.getTime() < now.getTime()) {
        targetDate.setFullYear(year + 1);
      }
    } else {
      // Fallback to offset data attribute if elements are missing
      const offsetDays = parseFloat(card.getAttribute("data-event-days")) || 0;
      targetDate = new Date();
      targetDate.setTime(targetDate.getTime() + (offsetDays * 24 * 60 * 60 * 1000));
    }
    
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

  /* ==========================================================================
     7. Curriculum Page ScrollSpy for Sticky Sidebar Menu
     ========================================================================== */
  const scrollSpyLinks = document.querySelectorAll(".jump-link");
  const scrollSpySections = document.querySelectorAll(".curriculum-section-block");

  if (scrollSpyLinks.length > 0 && scrollSpySections.length > 0) {
    const handleScrollSpy = () => {
      let activeSectionId = "";
      const scrollPos = window.scrollY || document.documentElement.scrollTop;
      // Add navbar height and some buffer offset to activate early
      const offset = 180; 

      scrollSpySections.forEach(section => {
        const top = section.offsetTop - offset;
        const bottom = top + section.offsetHeight;
        if (scrollPos >= top && scrollPos < bottom) {
          activeSectionId = section.getAttribute("id");
        }
      });

      scrollSpyLinks.forEach(link => {
        const targetId = link.getAttribute("href").substring(1);
        
        // Remove all possible active classes
        link.classList.remove("active-preschool", "active-primary", "active-secondary");

        if (targetId === activeSectionId) {
          if (targetId === "preschool") {
            link.classList.add("active-preschool");
          } else if (targetId === "primary") {
            link.classList.add("active-primary");
          } else if (targetId === "secondary") {
            link.classList.add("active-secondary");
          }
        }
      });
    };

    window.addEventListener("scroll", handleScrollSpy);
    handleScrollSpy(); // Trigger immediately to highlight correct active item on reload
  }

  /* ==========================================================================
     8. Contact Page Form Validation & Notifications
     ========================================================================== */
  const contactForm = document.getElementById("contactForm");
  const contactSuccess = document.getElementById("contactSuccess");

  if (contactForm && contactSuccess) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const nameInput = document.getElementById("contactName");
      const emailInput = document.getElementById("contactEmail");
      const phoneInput = document.getElementById("contactPhone");
      const subjectInput = document.getElementById("contactSubject");
      const messageInput = document.getElementById("contactMessage");

      let isValid = true;

      // Helper function to validate field
      const validateField = (input, condition) => {
        if (condition) {
          input.classList.remove("is-invalid");
          input.classList.add("is-valid");
        } else {
          input.classList.remove("is-valid");
          input.classList.add("is-invalid");
          isValid = false;
        }
      };

      // Validate Name
      validateField(nameInput, nameInput.value.trim() !== "");

      // Validate Email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      validateField(emailInput, emailRegex.test(emailInput.value.trim()));

      // Validate Phone (at least 8 chars check)
      validateField(phoneInput, phoneInput.value.trim().length >= 8);

      // Validate Subject
      validateField(subjectInput, subjectInput.value.trim() !== "");

      // Validate Message (at least 10 chars)
      validateField(messageInput, messageInput.value.trim().length >= 10);

      if (isValid) {
        // Reset inputs
        const inputs = [nameInput, emailInput, phoneInput, subjectInput, messageInput];
        inputs.forEach(input => {
          input.value = "";
          input.classList.remove("is-valid");
        });

        // Hide form, show success
        contactForm.classList.add("d-none");
        contactSuccess.classList.remove("d-none");

        // Scroll to success message
        contactSuccess.scrollIntoView({ behavior: "smooth", block: "center" });

        // Show form again after 7 seconds
        setTimeout(() => {
          contactSuccess.classList.add("d-none");
          contactForm.classList.remove("d-none");
        }, 7000);
      }
    });

    // Remove validation classes on input
    const formControls = contactForm.querySelectorAll(".form-control");
    formControls.forEach(control => {
      control.addEventListener("input", function() {
        this.classList.remove("is-invalid");
      });
    });
  }

  /* ==========================================================================
     9. Reasons Card Mobile Tap Flip Toggle
     ========================================================================== */
  const reasonCards = document.querySelectorAll(".reason-card-inner");
  reasonCards.forEach(card => {
    card.addEventListener("click", function(e) {
      this.classList.toggle("flipped");
    });
  });

  /* ==========================================================================
     10. Milestone Cards Mobile Tap Flip Toggle
     ========================================================================== */
  const milestoneCards = document.querySelectorAll(".milestone-card-inner");
  milestoneCards.forEach(card => {
    card.addEventListener("click", function(e) {
      this.classList.toggle("flipped");
    });
  });

  /* ==========================================================================
     11. Animated Counter Effect for Achievement Cards
     ========================================================================== */
  const counters = document.querySelectorAll(".counter-number");
  
  const countUp = (counter) => {
    const target = +counter.getAttribute("data-target");
    const duration = 2000; // 2 seconds total animation time
    const frameRate = 1000 / 60; // 60 FPS
    const totalFrames = Math.round(duration / frameRate);
    let frame = 0;
    
    const countAnimation = () => {
      frame++;
      const progress = frame / totalFrames;
      // Easing out quadratic
      const currentVal = Math.round(target * progress * (2 - progress));
      
      if (frame < totalFrames) {
        counter.innerText = currentVal;
        requestAnimationFrame(countAnimation);
      } else {
        counter.innerText = target;
      }
    };
    
    countAnimation();
  };
  
  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        countUp(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  counters.forEach(counter => {
    counterObserver.observe(counter);
  });
});

/* ==========================================================================
   Admin Dashboard client-side Controller (Direct Firestore/Storage)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  // 1. Session Auth Security Check (Firebase Auth Only)
  const checkSessionSecurity = () => {
    if (window.firebaseReady) {
      firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
          console.warn("Security rejection: Unauthorized user session redirected to login.");
          window.location.href = "admin-login.html";
        } else {
          document.getElementById("adminEmailHeader").textContent = user.email || "admin@engreg.com";
          initializeController();
        }
      });
    } else {
      console.error("Firebase SDK uninitialized. Forcing login redirect.");
      window.location.href = "admin-login.html";
    }
  };

  // Logout Trigger
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (window.firebaseReady && firebase.auth().currentUser) {
        try {
          await firebase.auth().signOut();
        } catch (err) {
          console.error("Signout error:", err);
        }
      }
      window.location.href = "admin-login.html";
    });
  }

  // Initialize Auth Security Check
  checkSessionSecurity();

  // Core initialization logic
  function initializeController() {
    // Collapse/Expand Sidebar
    const sidebar = document.getElementById("sidebar");
    const sidebarCollapse = document.getElementById("sidebarCollapse");
    if (sidebarCollapse && sidebar) {
      sidebarCollapse.onclick = () => sidebar.classList.toggle("collapsed");
    }

    // Handle SPA Tab Switching
    const sidebarLinks = document.querySelectorAll(".sidebar-link, .sidebar-sublink");
    const tabPanels = document.querySelectorAll(".tab-panel");

    sidebarLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        const tabId = link.getAttribute("data-tab");
        if (!tabId) return; // Dropdowns

        e.preventDefault();

        sidebarLinks.forEach(l => l.classList.remove("active"));
        tabPanels.forEach(p => p.classList.remove("active"));

        link.classList.add("active");
        const targetPanel = document.getElementById(tabId);
        if (targetPanel) {
          targetPanel.classList.add("active");
          
          if (tabId === "dashboard-tab") loadDashboardData();
          if (tabId === "gallery-tab") loadGalleryImages();
          if (tabId === "nursery-tab") loadCandidates("nursery");
          if (tabId === "high-tab") loadCandidates("high");
          if (tabId === "successful-tab") loadSuccessfulCandidates();
          if (tabId === "settings-tab") loadSettings();
        }

        if (window.innerWidth <= 991 && sidebar) {
          sidebar.classList.add("collapsed");
        }
      });
    });

    // Run first dashboard view load on start
    loadDashboardData();
    loadGalleryImages(); 
    setupDocumentUploadListeners();

    // Listen for public form submissions closing to refresh tables
    const nurseryModalEl = document.getElementById("nurseryModal");
    if (nurseryModalEl) {
      nurseryModalEl.addEventListener("hidden.bs.modal", () => {
        const form = document.getElementById("nurseryAdmissionForm");
        if (form) {
          form.removeAttribute("data-editing-id");
          form.reset();
        }
        loadCandidates("nursery");
        loadDashboardData();
      });
    }
    const highSchoolModalEl = document.getElementById("highSchoolModal");
    if (highSchoolModalEl) {
      highSchoolModalEl.addEventListener("hidden.bs.modal", () => {
        const form = document.getElementById("highSchoolAdmissionForm");
        if (form) {
          form.removeAttribute("data-editing-id");
          form.reset();
        }
        loadCandidates("high");
        loadDashboardData();
      });
    }
  }

  // Global Toast notifier
  const liveToast = document.getElementById("liveToast");
  const toastMessage = document.getElementById("toastMessage");
  let toastInstance = null;
  if (liveToast) {
    toastInstance = new bootstrap.Toast(liveToast);
  }

  function showToast(message, isSuccess = true) {
    if (!liveToast || !toastInstance) return;
    toastMessage.textContent = message;
    liveToast.className = `toast align-items-center text-white border-0 ${isSuccess ? 'bg-success' : 'bg-danger'}`;
    toastInstance.show();
  }

  // Helper: Write Logs directly to Firestore
  async function writeAuditLog(action, details) {
    if (!window.firebaseReady) return;
    try {
      const db = firebase.firestore();
      await db.collection("audit_logs").add({
        action: action,
        details: details,
        timestamp: new Date().toLocaleString(),
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to write audit log:", err);
    }
  }

  // ==========================================================================
  // 1. Dashboard Tab Overview & Analytics Chart
  // ==========================================================================
  let myChartInstance = null;

  async function loadDashboardData() {
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();

      const nurserySnapshot = await db.collection("nursery_primary_registration").get();
      const highSnapshot = await db.collection("high_school_registration").get();
      const nurserySuccessSnapshot = await db.collection("nursery_primary_successful").get();
      const highSuccessSnapshot = await db.collection("high_school_successful").get();
      const gallerySnapshot = await db.collection("gallery").get();

      const nurseryCount = nurserySnapshot.size;
      const highCount = highSnapshot.size;
      const nurserySuccessCount = nurserySuccessSnapshot.size;
      const highSuccessCount = highSuccessSnapshot.size;
      const totalSuccessCount = nurserySuccessCount + highSuccessCount;
      const galleryCount = gallerySnapshot.size;

      // Update figures
      document.getElementById("statNurseryReg").textContent = nurseryCount;
      document.getElementById("statHighReg").textContent = highCount;
      document.getElementById("statSuccessful").textContent = totalSuccessCount;

      // Load max image configurations limit
      const settingsDoc = await db.collection("settings").doc("global_config").get();
      let maxGallery = 100;
      if (settingsDoc.exists) {
        maxGallery = settingsDoc.data().maxGalleryImages || 100;
      }
      document.getElementById("statGalleryCount").textContent = `${galleryCount} / ${maxGallery}`;
      
      const progressPct = Math.min((galleryCount / maxGallery) * 100, 100);
      const progressBar = document.getElementById("statGalleryProgress");
      progressBar.style.width = `${progressPct}%`;
      progressBar.setAttribute("aria-valuenow", progressPct);

      renderChart(nurseryCount, highCount, nurserySuccessCount, highSuccessCount);
      loadLogs();
    } catch (err) {
      console.error("Dashboard statistics loading failed:", err);
    }
  }

  function renderChart(nursReg, highReg, nursSucc, highSucc) {
    const ctx = document.getElementById("admissionAnalyticsChart");
    if (!ctx) return;

    if (myChartInstance) {
      myChartInstance.destroy();
    }

    myChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Nursery & Primary', 'High School'],
        datasets: [
          {
            label: 'Registered Candidates',
            data: [nursReg, highReg],
            backgroundColor: 'rgba(11, 37, 69, 0.85)',
            borderColor: 'rgba(11, 37, 69, 1)',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Successful Candidates',
            data: [nursSucc, highSucc],
            backgroundColor: 'rgba(212, 175, 55, 0.95)',
            borderColor: 'rgba(212, 175, 55, 1)',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 5 }
          }
        },
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  async function loadLogs() {
    if (!window.firebaseReady) return;
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection("audit_logs").orderBy("createdAt", "desc").limit(10).get();
      
      const tbody = document.getElementById("logsTableBody");
      if (!tbody) return;
      tbody.innerHTML = "";
      
      snapshot.forEach(doc => {
        const log = doc.data();
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><span class="badge bg-secondary-light text-primary-dark">${log.action}</span></td>
          <td>${log.details}</td>
          <td class="text-nowrap">${log.timestamp}</td>
        `;
        tbody.appendChild(row);
      });
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  }

  // ==========================================================================
  // 2. Gallery Assets Management Panel
  // ==========================================================================
  const dropzone = document.getElementById("dropzone");
  const galleryFileInput = document.getElementById("galleryFileInput");
  const selectedFilename = document.getElementById("selectedFilename");
  const galleryUploadForm = document.getElementById("galleryUploadForm");
  const adminGalleryGrid = document.getElementById("adminGalleryGrid");

  if (dropzone && galleryFileInput) {
    dropzone.addEventListener("click", (e) => {
      if (e.target !== galleryFileInput) {
        galleryFileInput.click();
      }
    });
    
    ["dragover", "dragenter"].forEach(type => {
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(type => {
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        galleryFileInput.files = files;
        updateSelectedFileName(files[0].name);
      }
    });

    galleryFileInput.addEventListener("change", () => {
      if (galleryFileInput.files.length > 0) {
        updateSelectedFileName(galleryFileInput.files[0].name);
      }
    });
  }

  function updateSelectedFileName(name) {
    selectedFilename.textContent = name;
    selectedFilename.classList.remove("d-none");
  }

  if (galleryUploadForm) {
    galleryUploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById("galleryFileInput");
      const category = document.getElementById("uploadCategory").value;
      const caption = document.getElementById("uploadCaption").value;
      const errorDiv = document.getElementById("uploadFormError");
      const progressBar = document.getElementById("uploadProgressBar");
      const progressContainer = document.getElementById("uploadProgressBarContainer");

      errorDiv.classList.add("d-none");

      if (fileInput.files.length === 0) {
        errorDiv.textContent = "Please select an image file to upload.";
        errorDiv.classList.remove("d-none");
        return;
      }

      const file = fileInput.files[0];
      progressContainer.classList.remove("d-none");
      progressBar.style.width = "20%";

      try {
        progressBar.style.width = "50%";
        const base64Data = await fileToBase64(file, 800, 0.7);
        progressBar.style.width = "80%";

        if (!window.firebaseReady) {
          throw new Error("Firebase database connection is uninitialized.");
        }

        const db = firebase.firestore();
        await db.collection("gallery").add({
          imageUrl: base64Data,
          category: category,
          caption: caption,
          createdAt: new Date().toISOString()
        });

        await writeAuditLog("Upload Photo", `Uploaded new gallery photo "${caption}" in category [${category}].`);
        
        progressBar.style.width = "100%";
        setTimeout(() => {
          progressContainer.classList.add("d-none");
          progressBar.style.width = "0%";
          showToast("Image uploaded successfully.");
          galleryUploadForm.reset();
          selectedFilename.classList.add("d-none");
          loadGalleryImages();
          loadDashboardData();
        }, 300);

      } catch (err) {
        console.error("Direct upload failed:", err);
        progressContainer.classList.add("d-none");
        errorDiv.textContent = "Upload failed: " + err.message;
        errorDiv.classList.remove("d-none");
      }
    });
  }

  async function loadGalleryImages() {
    if (!adminGalleryGrid) return;
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();
      const snapshot = await db.collection("gallery").orderBy("createdAt", "desc").get();
      
      adminGalleryGrid.innerHTML = "";
      const max_gallery = 100;
      document.getElementById("galleryQuotaBadge").textContent = `Quota: ${snapshot.size} / ${max_gallery} Uploaded`;

      if (snapshot.empty) {
        adminGalleryGrid.innerHTML = `<div class="col-12 text-center py-4 text-muted">No images found in the gallery database.</div>`;
        return;
      }

      snapshot.forEach(doc => {
        const img = doc.data();
        const card = document.createElement("div");
        card.className = "col";
        card.innerHTML = `
          <div class="admin-gallery-card">
            <img src="${img.imageUrl}" alt="${img.caption}" onerror="this.src='https://placehold.co/400x300/0b2545/d4af37?text=Image'">
            <span class="gallery-card-badge">${img.category}</span>
            <div class="gallery-card-actions">
              <button class="btn btn-danger btn-sm rounded-circle shadow-sm" onclick="deleteGalleryImage('${doc.id}', '${img.caption}')" title="Delete">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
          <p class="small text-truncate text-muted mt-2 mb-0 fw-semibold px-1" title="${img.caption}">${img.caption}</p>
        `;
        adminGalleryGrid.appendChild(card);
      });
    } catch (err) {
      console.error("Failed to load gallery images:", err);
    }
  }

  window.deleteGalleryImage = async (id, caption) => {
    if (!window.firebaseReady) return;
    if (confirm(`Are you sure you want to permanently delete "${caption}"?`)) {
      try {
        const db = firebase.firestore();
        await db.collection("gallery").doc(id).delete();
        await writeAuditLog("Delete Photo", `Permanently deleted gallery photo "${caption}".`);
        showToast("Gallery photo deleted.");
        loadGalleryImages();
        loadDashboardData();
      } catch (err) {
        console.error("Failed to delete gallery image:", err);
        showToast("Failed to delete image: " + err.message, false);
      }
    }
  };

  // ==========================================================================
  // 3. Admissions Registry: Candidates & Document Downloader
  // ==========================================================================
  let activeCandidates = { nursery: [], high: [] };
  let selectedCandidateIds = { nursery: [], high: [] };

  // Class Selection Listener
  const classFilters = document.querySelectorAll(".filter-trigger-select");
  classFilters.forEach(select => {
    select.addEventListener("change", () => {
      const school = select.getAttribute("data-school");
      const tableContainer = document.getElementById(`${school}TableContainer`);
      const placeholderText = document.getElementById(`${school}PlaceholderText`);
      
      if (tableContainer) tableContainer.classList.remove("d-none");
      if (placeholderText) placeholderText.classList.add("d-none");

      loadCandidates(school);
    });
  });

  // Genders Filter selection
  const genderFilters = document.querySelectorAll("[id$='GenderFilter']");
  genderFilters.forEach(select => {
    select.addEventListener("change", () => {
      const school = select.id.startsWith("nursery") ? "nursery" : "high";
      loadCandidates(school);
    });
  });

  // Search input listeners
  const searchInputs = document.querySelectorAll("[id$='SearchInput']");
  searchInputs.forEach(input => {
    input.addEventListener("input", () => {
      const school = input.id.startsWith("nursery") ? "nursery" : "high";
      renderCandidatesTable(school);
    });
  });

  async function loadCandidates(school) {
    const classVal = document.getElementById(`${school}ClassFilter`).value;
    const genderVal = document.getElementById(`${school}GenderFilter`).value;

    if (!classVal) return;
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();
      const colName = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
      
      let query = db.collection(colName);
      if (classVal !== "all") {
        query = query.where("class", "==", classVal);
      }
      if (genderVal) {
        query = query.where("gender", "==", genderVal);
      }

      const snapshot = await query.get();
      const list = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        
        let candName = "Unnamed Candidate";
        if (school === "nursery") {
          candName = d.nurseryChildName || "Unnamed Pupil";
        } else {
          if (d.highSchoolSurname || d.highSchoolOtherNames) {
            candName = `${d.highSchoolSurname || ""} ${d.highSchoolOtherNames || ""}`.trim();
          } else {
            candName = d.highSchoolName || d.highSchoolDeclName || "Unnamed Student";
          }
        }

        const parentNameVal = d.nurseryFatherName || d.nurseryMotherName || d.nurseryParentName || d.highSchoolParentName || "";
        const parentPhoneVal = d.nurseryFatherHomeTel || d.nurseryMotherHomeTel || d.nurseryPhone || d.highSchoolParentHomeTel || d.highSchoolPhone || "";

        list.push({
          id: doc.id,
          name: candName,
          gender: d.gender || d.nurseryGender || d.highSchoolGender || "",
          parentName: parentNameVal,
          parentPhone: parentPhoneVal,
          passportUrl: d.passportUrl || "#",
          birthCertUrl: d.birthCertUrl || "#",
          resultUrl: d.resultFileUrl || d.resultUrl || "#",
          testimonialUrl: d.testimonialUrl || "#",
          passed: d.passed || false
        });
      });

      activeCandidates[school] = list;
      selectedCandidateIds[school] = [];
      renderCandidatesTable(school);
    } catch (err) {
      console.error("Candidates fetch failed:", err);
    }
  }

  function renderCandidatesTable(school) {
    const tbody = document.getElementById(`${school}TableBody`);
    if (!tbody) return;
    
    const searchVal = document.getElementById(`${school}SearchInput`).value.toLowerCase().trim();
    const selectAllCheckbox = document.getElementById(`${school}SelectAll`);
    
    tbody.innerHTML = "";
    selectAllCheckbox.checked = false;

    const candidates = activeCandidates[school].filter(cand => {
      return cand.name.toLowerCase().includes(searchVal) || cand.parentPhone.includes(searchVal);
    });

    if (candidates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No candidate registrations found matching criteria.</td></tr>`;
      updateSelectionCounter(school);
      return;
    }

    candidates.forEach((cand) => {
      const isChecked = selectedCandidateIds[school].includes(cand.id) ? "checked" : "";
      const isPassed = cand.passed ? "checked" : "";
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <input class="form-check-input row-select-cb" type="checkbox" data-id="${cand.id}" ${isChecked}>
        </td>
        <td>
          <img src="${cand.passportUrl !== '#' ? cand.passportUrl : 'https://placehold.co/40x40/0b2545/d4af37?text=Avatar'}" 
               alt="Passport" class="rounded shadow-sm" style="width: 40px; height: 40px; object-fit: cover;"
               onerror="this.src='https://placehold.co/40x40/0b2545/d4af37?text=ES'">
        </td>
        <td><strong class="text-primary-dark">${cand.name}</strong></td>
        <td>${cand.gender}</td>
        <td>${cand.parentName}</td>
        <td>${cand.parentPhone}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-nav-sm py-1 px-2 border small" onclick="downloadFile('${cand.birthCertUrl}', 'Birth Certificate')" title="Birth Certificate">
              <i class="fa-solid fa-cake-candles text-primary"></i>
            </button>
            <button class="btn btn-outline-nav-sm py-1 px-2 border small" onclick="downloadFile('${cand.resultUrl}', 'Academic Result')" title="Academic Result">
              <i class="fa-solid fa-square-poll-vertical text-warning"></i>
            </button>
            <button class="btn btn-outline-nav-sm py-1 px-2 border small" onclick="downloadFile('${cand.testimonialUrl}', 'School Testimonial')" title="School Testimonial">
              <i class="fa-solid fa-award text-success"></i>
            </button>
          </div>
        </td>
        <td class="text-center">
          <input class="form-check-input passed-toggle-cb" type="checkbox" data-id="${cand.id}" ${isPassed}>
        </td>
        <td class="text-end text-nowrap">
          <button class="btn btn-outline-primary btn-sm rounded-circle me-1" onclick="editCandidate('${school}', '${cand.id}')" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-outline-danger btn-sm rounded-circle me-1" onclick="deleteCandidate('${school}', '${cand.id}', '${cand.name}')" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;

      // Single Checkbox Selection listener
      row.querySelector(".row-select-cb").addEventListener("change", (e) => {
        const cid = e.target.getAttribute("data-id");
        if (e.target.checked) {
          selectedCandidateIds[school].push(cid);
        } else {
          selectedCandidateIds[school] = selectedCandidateIds[school].filter(id => id !== cid);
        }
        updateSelectionCounter(school);
      });

      // Exam state toggle listener
      row.querySelector(".passed-toggle-cb").addEventListener("change", async (e) => {
        const cid = e.target.getAttribute("data-id");
        const passedVal = e.target.checked;
        
        if (!window.firebaseReady) return;
        try {
          const db = firebase.firestore();
          const colName = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
          await db.collection(colName).doc(cid).update({ passed: passedVal });
          
          const target = activeCandidates[school].find(c => c.id === cid);
          if (target) target.passed = passedVal;
          
          await writeAuditLog("Exam Toggle", `Set examination status for candidate "${cand.name}" to ${passedVal ? 'PASSED' : 'PENDING'}.`);
          showToast(`Updated examination status for ${cand.name}.`);
        } catch (err) {
          e.target.checked = !passedVal;
          showToast("Failed to update status: " + err.message, false);
        }
      });

      tbody.appendChild(row);
    });

    updateSelectionCounter(school);
  }

  window.downloadFile = (url, name) => {
    if (!url || url === "#" || url === "data:") {
      alert(`${name} is not uploaded for this candidate.`);
      return;
    }
    
    try {
      // Create a temporary link
      const link = document.createElement("a");
      link.href = url;
      
      // Determine file extension from base64 MIME type
      let ext = "png";
      if (url.startsWith("data:")) {
        const mime = url.split(";")[0].split(":")[1];
        if (mime === "application/pdf") ext = "pdf";
        else if (mime === "image/jpeg" || mime === "image/jpg") ext = "jpg";
        else if (mime === "image/gif") ext = "gif";
      }
      
      link.download = `${name.replace(/\s+/g, "_")}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed, fallback to open in window:", err);
      window.open(url, "_blank");
    }
  };

  window.editCandidate = async (school, id) => {
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();
      const colName = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
      
      const doc = await db.collection(colName).doc(id).get();
      if (!doc.exists) {
        alert("Candidate document not found.");
        return;
      }
      
      const data = doc.data();
      const form = document.getElementById(school === "nursery" ? "nurseryAdmissionForm" : "highSchoolAdmissionForm");
      if (!form) return;
      
      form.setAttribute("data-editing-id", id);
      
      const inputs = form.querySelectorAll("input, select, textarea");
      inputs.forEach(input => {
        if (input.type === "file") return;
        
        const key = input.name || input.id;
        if (key && data[key] !== undefined) {
          if (input.type === "radio" || input.type === "checkbox") {
            input.checked = (input.value === data[key]);
          } else {
            input.value = data[key];
          }
        }
      });
      
      // Trigger DOB update to refresh age display
      const dobEl = form.querySelector('input[type="date"]');
      if (dobEl) {
        dobEl.dispatchEvent(new Event("change"));
        dobEl.dispatchEvent(new Event("input"));
      }

      // Show the Bootstrap modal
      const modalEl = document.getElementById(school === "nursery" ? "nurseryModal" : "highSchoolModal");
      if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
          modal = new bootstrap.Modal(modalEl);
        }
        modal.show();
      }
    } catch (err) {
      console.error("Failed to load candidate details for edit:", err);
      alert("Error loading candidate details: " + err.message);
    }
  };

  // Checkbox Select All Toggle
  const selectAllCbs = document.querySelectorAll("[id$='SelectAll']");
  selectAllCbs.forEach(allCb => {
    allCb.addEventListener("change", (e) => {
      const school = allCb.id.startsWith("nursery") ? "nursery" : "high";
      const tableBody = document.getElementById(`${school}TableBody`);
      const rowCbs = tableBody.querySelectorAll(".row-select-cb");

      selectedCandidateIds[school] = [];
      rowCbs.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          selectedCandidateIds[school].push(cb.getAttribute("data-id"));
        }
      });
      updateSelectionCounter(school);
    });
  });

  function updateSelectionCounter(school) {
    const count = selectedCandidateIds[school].length;
    const countEl = document.getElementById(`${school}SelectedCount`);
    if (countEl) countEl.textContent = `${count} Candidates Selected`;
    const btnMove = document.getElementById(`${school}BtnMoveSuccessful`);
    if (btnMove) btnMove.disabled = count === 0;
  }

  // Move registration candidates to Successful list
  const moveButtons = document.querySelectorAll("[id$='BtnMoveSuccessful']");
  moveButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const school = btn.id.startsWith("nursery" ? "nursery" : "high") ? "nursery" : "high";
      const count = selectedCandidateIds[school].length;
      
      if (confirm(`Are you sure you want to move the ${count} selected candidates to the Successful list? This deletes their original registrations records.`)) {
        btn.disabled = true;
        if (!window.firebaseReady) return;

        try {
          const db = firebase.firestore();
          const sourceCol = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
          const destCol = school === "nursery" ? "nursery_primary_successful" : "high_school_successful";

          for (const cid of selectedCandidateIds[school]) {
            const doc = await db.collection(sourceCol).doc(cid).get();
            if (doc.exists) {
              const data = doc.data();
              // Save to Successful collection
              await db.collection(destCol).add({
                name: data.nurseryChildName || data.highSchoolName || data.highSchoolDeclName || "Unnamed Admitted",
                parentPhone: data.nurseryPhone || data.highSchoolPhone || "",
                createdAt: new Date().toISOString()
              });
              // Delete from original applications
              await db.collection(sourceCol).doc(cid).delete();
            }
          }

          await writeAuditLog("Promote Candidates", `Moved ${count} candidates to successful admissions database.`);
          showToast(`Moved ${count} candidates to successful admissions list.`);
          loadCandidates(school);
          loadDashboardData();
        } catch (err) {
          showToast("Failed to promote candidates: " + err.message, false);
          btn.disabled = false;
        }
      }
    });
  });

  // Delete active application candidate
  window.deleteCandidate = async (school, id, name) => {
    if (confirm(`Are you sure you want to permanently delete candidate registration for "${name}"? This deletes all their database fields.`)) {
      if (!window.firebaseReady) return;
      try {
        const db = firebase.firestore();
        const col = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
        await db.collection(col).doc(id).delete();
        
        await writeAuditLog("Delete Candidate", `Permanently deleted active candidate application for "${name}".`);
        showToast("Candidate deleted successfully.");
        loadCandidates(school);
        loadDashboardData();
      } catch (err) {
        showToast("Delete failed: " + err.message, false);
      }
    }
  };

  // ==========================================================================
  // 4. Manual Candidate Registration Form (Modal popup)
  // ==========================================================================
  const addCandidateModalEl = document.getElementById("addCandidateModal");
  let addCandidateModalInstance = null;
  if (addCandidateModalEl) {
    addCandidateModalInstance = new bootstrap.Modal(addCandidateModalEl);
  }

  window.openAddCandidateModal = (school) => {
    if (!addCandidateModalInstance) return;
    
    document.getElementById("addCandSchoolType").value = school;
    document.getElementById("addCandidateForm").reset();
    document.getElementById("addCandidateModalError").classList.add("d-none");
    
    const label = document.getElementById("addCandidateModalLabel");
    const classSelect = document.getElementById("addCandClass");
    classSelect.innerHTML = "";

    if (school === "nursery") {
      label.textContent = "Register New Pupil (Nursery & Primary)";
      const classes = ["Foundation 1", "Foundation 2", "Nursery 1", "Nursery 2", "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"];
      classes.forEach(c => classSelect.innerHTML += `<option value="${c}">${c}</option>`);
    } else {
      label.textContent = "Register New Student (High School)";
      const classes = ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"];
      classes.forEach(c => classSelect.innerHTML += `<option value="${c}">${c}</option>`);
    }

    addCandidateModalInstance.show();
  };

  // Local state helper for file uploads on manual form
  const manualFiles = {};
  function setupDocumentUploadListeners() {
    const inputs = [
      { id: "addCandPassportFile", key: "passportUrl" },
      { id: "addCandBirthFile", key: "birthCertUrl" },
      { id: "addCandResultFile", key: "resultFileUrl" },
      { id: "addCandTestimonialFile", key: "testimonialUrl" }
    ];

    inputs.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const labelEl = el.closest(".mb-3")?.querySelector(".form-label");
          const originalLabel = labelEl ? labelEl.textContent : "";
          if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-accent small"><i class="fa-solid fa-spinner fa-spin"></i> Processing...</span>`;

          try {
            const base64Data = await fileToBase64(file);
            manualFiles[item.key] = base64Data;
            if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-success small"><i class="fa-solid fa-check"></i> Done</span>`;
          } catch (err) {
            console.error("File processing failed:", err);
            if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-danger small">Processing failed</span>`;
          }
        });
      }
    });
  }

  const addCandidateForm = document.getElementById("addCandidateForm");
  if (addCandidateForm) {
    addCandidateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const school = document.getElementById("addCandSchoolType").value;
      const name = document.getElementById("addCandName").value.trim();
      const gender = document.getElementById("addCandGender").value;
      const targetClass = document.getElementById("addCandClass").value;
      const parentName = document.getElementById("addCandParentName").value.trim();
      const parentPhone = document.getElementById("addCandPhone").value.trim();
      
      if (!window.firebaseReady) return;

      try {
        const db = firebase.firestore();
        const col = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";

        const payload = {
          class: targetClass,
          gender: gender,
          createdAt: new Date().toISOString(),
          status: "pending",
          passed: false,
          passportUrl: manualFiles["passportUrl"] || "",
          birthCertUrl: manualFiles["birthCertUrl"] || "",
          resultFileUrl: manualFiles["resultFileUrl"] || "",
          testimonialUrl: manualFiles["testimonialUrl"] || ""
        };

        if (school === "nursery") {
          payload.nurseryChildName = name;
          payload.nurseryParentName = parentName;
          payload.nurseryPhone = parentPhone;
        } else {
          payload.highSchoolName = name;
          payload.highSchoolParentName = parentName;
          payload.highSchoolPhone = parentPhone;
        }

        await db.collection(col).add(payload);
        await writeAuditLog("Manual Register", `Registered new candidate "${name}" manually in class [${targetClass}].`);
        
        showToast(`Successfully registered ${name} in ${targetClass}.`);
        addCandidateModalInstance.hide();
        loadCandidates(school);
        loadDashboardData();
      } catch (err) {
        showToast("Registration failed: " + err.message, false);
      }
    });
  }

  // ==========================================================================
  // 5. Successful Candidates Module (View/Move back/Delete)
  // ==========================================================================
  let selectedSuccIds = { nursery: [], high: [] };

  async function loadSuccessfulCandidates() {
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();

      const nurserySnapshot = await db.collection("nursery_primary_successful").get();
      const nurseryList = [];
      nurserySnapshot.forEach(doc => {
        nurseryList.push({ id: doc.id, ...doc.data() });
      });
      renderSuccessfulTable("nursery", nurseryList);

      const highSnapshot = await db.collection("high_school_successful").get();
      const highList = [];
      highSnapshot.forEach(doc => {
        highList.push({ id: doc.id, ...doc.data() });
      });
      renderSuccessfulTable("high", highList);
    } catch (err) {
      console.error("Failed to load successful candidates:", err);
    }
  }

  function renderSuccessfulTable(school, list) {
    const tbody = document.getElementById(`succ${school.charAt(0).toUpperCase() + school.slice(1)}TableBody`);
    const selectAll = document.getElementById(`succ${school.charAt(0).toUpperCase() + school.slice(1)}SelectAll`);
    if (!tbody || !selectAll) return;
    
    tbody.innerHTML = "";
    selectAll.checked = false;
    selectedSuccIds[school] = [];

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No successful candidates found.</td></tr>`;
      updateSuccessfulControls(school);
      return;
    }

    list.forEach(succ => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <input class="form-check-input succ-select-cb" type="checkbox" data-id="${succ.id}">
        </td>
        <td><strong class="text-primary-dark">${succ.name}</strong></td>
        <td>${succ.parentPhone}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-outline-danger btn-sm rounded-circle me-1" onclick="deleteSuccessful('${school}', '${succ.id}', '${succ.name}')" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;

      row.querySelector(".succ-select-cb").addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        if (e.target.checked) {
          selectedSuccIds[school].push(id);
        } else {
          selectedSuccIds[school] = selectedSuccIds[school].filter(i => i !== id);
        }
        updateSuccessfulControls(school);
      });

      tbody.appendChild(row);
    });

    selectAll.onchange = (e) => {
      const cbs = tbody.querySelectorAll(".succ-select-cb");
      selectedSuccIds[school] = [];
      cbs.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          selectedSuccIds[school].push(cb.getAttribute("data-id"));
        }
      });
      updateSuccessfulControls(school);
    };

    updateSuccessfulControls(school);
  }

  function updateSuccessfulControls(school) {
    const btnReturn = document.getElementById(`${school}BtnReturnReg`);
    if (btnReturn) btnReturn.disabled = selectedSuccIds[school].length === 0;
  }

  window.deleteSuccessful = async (school, id, name) => {
    if (confirm(`Are you sure you want to permanently delete successful candidate "${name}"? This removes them from the success directories.`)) {
      if (!window.firebaseReady) return;

      try {
        const db = firebase.firestore();
        const col = school === "nursery" ? "nursery_primary_successful" : "high_school_successful";
        await db.collection(col).doc(id).delete();

        await writeAuditLog("Delete Successful", `Deleted "${name}" from successful candidate notice rosters.`);
        showToast("Successful candidate deleted.");
        loadSuccessfulCandidates();
        loadDashboardData();
      } catch (err) {
        showToast("Delete failed: " + err.message, false);
      }
    }
  };

  // Return to active registration action
  const returnButtons = document.querySelectorAll("[id$='BtnReturnReg']");
  returnButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const school = btn.id.startsWith("nursery" ? "nursery" : "high") ? "nursery" : "high";
      const count = selectedSuccIds[school].length;

      if (confirm(`Are you sure you want to return the ${count} selected candidates back to active Registrations?`)) {
        if (!window.firebaseReady) return;

        try {
          const db = firebase.firestore();
          const sourceCol = school === "nursery" ? "nursery_primary_successful" : "high_school_successful";
          const destCol = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";

          for (const sid of selectedSuccIds[school]) {
            const doc = await db.collection(sourceCol).doc(sid).get();
            if (doc.exists) {
              const data = doc.data();
              
              const payload = {
                class: school === "nursery" ? "Foundation 1" : "JSS 1", // Default category fallback
                gender: "Male",
                createdAt: new Date().toISOString(),
                status: "pending",
                passed: true,
                passportUrl: "#", birthCertUrl: "#", resultFileUrl: "#", testimonialUrl: "#"
              };

              if (school === "nursery") {
                payload.nurseryChildName = data.name;
                payload.nurseryParentName = "Returned Parent";
                payload.nurseryPhone = data.parentPhone;
              } else {
                payload.highSchoolName = data.name;
                payload.highSchoolParentName = "Returned Parent";
                payload.highSchoolPhone = data.parentPhone;
              }

              await db.collection(destCol).add(payload);
              await db.collection(sourceCol).doc(sid).delete();
            }
          }

          await writeAuditLog("Demote Candidates", `Returned ${count} candidates back to active registration registry.`);
          showToast(`Returned ${count} candidates to active registrations.`);
          loadSuccessfulCandidates();
          loadDashboardData();
        } catch (err) {
          showToast("Failed to return candidates: " + err.message, false);
        }
      }
    });
  });

  // ==========================================================================
  // 6. Reports & Downloads Handler (PDF, EXCEL, PRINT)
  // ==========================================================================
  window.exportTable = (tableType, format) => {
    alert(`Exporting ${tableType.toUpperCase()} registry table to ${format.toUpperCase()} format... (Backend task queued)`);
  };

  window.printSuccessfulList = () => {
    window.print();
  };

  // ==========================================================================
  // 7. Portal Settings Config Manager
  // ==========================================================================
  const portalSettingsForm = document.getElementById("portalSettingsForm");
  
  async function loadSettings() {
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();
      const doc = await db.collection("settings").doc("global_config").get();
      
      if (doc.exists) {
        const config = doc.data();
        document.getElementById("setSchoolName").value = config.schoolName || "";
        document.getElementById("setSchoolEmail").value = config.administrativeEmail || "";
        document.getElementById("setSchoolPhone1").value = config.primaryPhone || "";
        document.getElementById("setSchoolPhone2").value = config.secondaryPhone || "";
        document.getElementById("setSchoolAddress").value = config.schoolContactAddress || "";
        document.getElementById("setAdmissionFee").value = config.applicationFormFee || "";
        document.getElementById("setAcademicSession").value = config.activeAcademicSession || "";
        document.getElementById("setMaxGalleryImages").value = config.maxGalleryImages || "";
        document.getElementById("setFacebook").value = config.facebookLink || "";
        document.getElementById("setInstagram").value = config.instagramLink || "";
        document.getElementById("setTwitter").value = config.twitterLink || "";
        document.getElementById("setLinkedin").value = config.linkedinLink || "";
        document.getElementById("setYoutube").value = config.youtubeLink || "";
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  if (portalSettingsForm) {
    portalSettingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const payload = {
        schoolName: document.getElementById("setSchoolName").value.trim(),
        administrativeEmail: document.getElementById("setSchoolEmail").value.trim(),
        primaryPhone: document.getElementById("setSchoolPhone1").value.trim(),
        secondaryPhone: document.getElementById("setSchoolPhone2").value.trim(),
        schoolContactAddress: document.getElementById("setSchoolAddress").value.trim(),
        applicationFormFee: parseInt(document.getElementById("setAdmissionFee").value),
        activeAcademicSession: document.getElementById("setAcademicSession").value.trim(),
        maxGalleryImages: parseInt(document.getElementById("setMaxGalleryImages").value),
        facebookLink: document.getElementById("setFacebook").value.trim(),
        instagramLink: document.getElementById("setInstagram").value.trim(),
        twitterLink: document.getElementById("setTwitter").value.trim(),
        linkedinLink: document.getElementById("setLinkedin").value.trim(),
        youtubeLink: document.getElementById("setYoutube").value.trim()
      };

      if (!window.firebaseReady) return;

      try {
        const db = firebase.firestore();
        await db.collection("settings").doc("global_config").set(payload);

        await writeAuditLog("Update Settings", "Updated global portal settings configurations.");
        
        const settingsAlert = document.getElementById("settingsAlert");
        settingsAlert.classList.remove("d-none");
        showToast("Configuration settings saved successfully.");
        setTimeout(() => {
          settingsAlert.classList.add("d-none");
        }, 3000);
      } catch (err) {
        showToast("Failed to save settings: " + err.message, false);
      }
    });
  }

  // Helper: Convert File to Base64 (with optional compression for images)
  const fileToBase64 = (file, maxDimension = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = function (event) {
          const img = new Image();
          img.onload = function () {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(dataUrl);
          };
          img.onerror = (err) => reject(err);
          img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      }
    });
  };

});

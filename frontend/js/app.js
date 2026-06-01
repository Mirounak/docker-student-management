"use strict";

// ---- API Configuration ----
const apiMetaTag = document.querySelector('meta[name="api-base-url"]');
const apiBaseFromMeta = apiMetaTag ? apiMetaTag.content.trim() : "";
const isFileProtocol = window.location.protocol === "file:";
const defaultBase =
  apiBaseFromMeta ||
  window.API_BASE_URL ||
  (isFileProtocol || !window.location.hostname
    ? "http://localhost:8080"
    : `${window.location.protocol}//${window.location.hostname}:8080`);
const API_URL = `${defaultBase.replace(/\/$/, "")}/students`;

// ---- UI State ----
const state = {
  students: [],
  searchTerm: "",
  sortField: "id",
  sortOrder: "asc",
  pageSize: 5,
  currentPage: 1,
};

// ---- DOM References ----
const totalStudentsEl = document.getElementById("totalStudents");
const backendStatusEl = document.getElementById("backendStatus");
const dbStatusEl = document.getElementById("dbStatus");
const dockerStatusEl = document.getElementById("dockerStatus");

const tableBodyEl = document.getElementById("studentsTableBody");
const paginationEl = document.getElementById("pagination");
const paginationInfoEl = document.getElementById("paginationInfo");
const emptyStateEl = document.getElementById("emptyState");
const loadingOverlayEl = document.getElementById("loadingOverlay");
const tableSkeletonEl = document.getElementById("tableSkeleton");

const searchInputEl = document.getElementById("searchInput");
const sortFieldEl = document.getElementById("sortField");
const sortOrderEl = document.getElementById("sortOrder");
const pageSizeEl = document.getElementById("pageSize");
const toastContainerEl = document.getElementById("toastContainer");

const addStudentForm = document.getElementById("addStudentForm");
const editStudentForm = document.getElementById("editStudentForm");
const deleteStudentMessage = document.getElementById("deleteStudentMessage");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");

const addStudentModalEl = document.getElementById("addStudentModal");
const editStudentModalEl = document.getElementById("editStudentModal");
const deleteStudentModalEl = document.getElementById("deleteStudentModal");

const addStudentModal = bootstrap.Modal.getOrCreateInstance(addStudentModalEl);
const editStudentModal = bootstrap.Modal.getOrCreateInstance(editStudentModalEl);
const deleteStudentModal = bootstrap.Modal.getOrCreateInstance(deleteStudentModalEl);

let deleteTargetId = null;

// ---- Utilities ----
const showLoading = (isLoading) => {
  loadingOverlayEl.classList.toggle("d-none", !isLoading);
  tableSkeletonEl.classList.toggle("d-none", !isLoading);
};

const showToast = (variant, message) => {
  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center text-bg-${variant} border-0 mb-2`;
  toastEl.setAttribute("role", "alert");
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  toastContainerEl.appendChild(toastEl);
  const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 });
  toast.show();
  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
};

const setStatus = (element, label, variant) => {
  element.textContent = label;
  element.classList.remove("online", "offline");
  if (variant) {
    element.classList.add(variant);
  }
};

const getErrorMessage = async (response) => {
  try {
    const data = await response.json();
    return data.message || JSON.stringify(data);
  } catch (error) {
    return response.statusText || "Unexpected server error.";
  }
};

const animateCounter = (element, target, force = false) => {
  const currentValue = Number(element.textContent) || 0;
  if (!force && element.dataset.animated === "true") {
    return;
  }
  if (currentValue === target && !force) {
    element.dataset.animated = "true";
    return;
  }
  const start = currentValue;
  const duration = 1200;
  const startTime = performance.now();
  element.dataset.animated = "true";

  const step = (time) => {
    const progress = Math.min((time - startTime) / duration, 1);
    const value = Math.round(start + (target - start) * progress);
    element.textContent = value.toString();
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
};

// ---- Data Fetching ----
const fetchStudents = async () => {
  showLoading(true);
  setStatus(backendStatusEl, "Checking", "");
  setStatus(dbStatusEl, "Checking", "");
  setStatus(dockerStatusEl, "Checking", "");

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    state.students = await response.json();
    state.currentPage = 1;
    setStatus(backendStatusEl, "Online", "online");
    setStatus(dbStatusEl, "Connected", "online");
    setStatus(dockerStatusEl, "Running", "online");
    render();
  } catch (error) {
    showToast("danger", `Failed to load students. ${error.message}`);
    setStatus(backendStatusEl, "Offline", "offline");
    setStatus(dbStatusEl, "Unavailable", "offline");
    setStatus(dockerStatusEl, "Unknown", "offline");
    render();
  } finally {
    showLoading(false);
  }
};

const createStudent = async (payload) => {
  showLoading(true);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    showToast("success", "Student created successfully.");
    addStudentModal.hide();
    addStudentForm.reset();
    await fetchStudents();
  } catch (error) {
    showToast("danger", `Unable to create student. ${error.message}`);
  } finally {
    showLoading(false);
  }
};

const updateStudent = async (id, payload) => {
  showLoading(true);
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    showToast("success", "Student updated successfully.");
    editStudentModal.hide();
    await fetchStudents();
  } catch (error) {
    showToast("danger", `Unable to update student. ${error.message}`);
  } finally {
    showLoading(false);
  }
};

const deleteStudent = async (id) => {
  showLoading(true);
  try {
    const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    showToast("success", "Student deleted successfully.");
    deleteStudentModal.hide();
    await fetchStudents();
  } catch (error) {
    showToast("danger", `Unable to delete student. ${error.message}`);
  } finally {
    showLoading(false);
  }
};

// ---- Rendering ----
const getFilteredSortedStudents = () => {
  const term = state.searchTerm.trim().toLowerCase();
  let filtered = state.students.filter((student) => {
    if (!term) return true;
    return (
      student.firstName.toLowerCase().includes(term) ||
      student.lastName.toLowerCase().includes(term) ||
      student.email.toLowerCase().includes(term)
    );
  });

  const { sortField, sortOrder } = state;
  filtered.sort((a, b) => {
    const valueA = a[sortField];
    const valueB = b[sortField];
    if (sortField === "id") {
      return sortOrder === "asc" ? valueA - valueB : valueB - valueA;
    }
    const textA = valueA.toString().toLowerCase();
    const textB = valueB.toString().toLowerCase();
    if (textA === textB) return 0;
    const comparison = textA > textB ? 1 : -1;
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return filtered;
};

const renderTable = (students) => {
  tableBodyEl.innerHTML = "";
  students.forEach((student) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${student.id}</td>
      <td>${student.firstName}</td>
      <td>${student.lastName}</td>
      <td>${student.email}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-info me-2" data-action="edit" data-id="${student.id}">
          Edit
        </button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${student.id}">
          Delete
        </button>
      </td>
    `;
    tableBodyEl.appendChild(row);
  });
};

const renderPagination = (totalItems) => {
  paginationEl.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);

  const createPageItem = (label, page, isDisabled, isActive) => {
    const li = document.createElement("li");
    li.className = `page-item ${isDisabled ? "disabled" : ""} ${isActive ? "active" : ""}`;
    const button = document.createElement("button");
    button.className = "page-link";
    button.textContent = label;
    button.disabled = isDisabled;
    button.addEventListener("click", () => {
      state.currentPage = page;
      render();
    });
    li.appendChild(button);
    paginationEl.appendChild(li);
  };

  createPageItem("Prev", Math.max(1, state.currentPage - 1), state.currentPage === 1, false);

  for (let page = 1; page <= totalPages; page += 1) {
    createPageItem(page, page, false, page === state.currentPage);
  }

  createPageItem("Next", Math.min(totalPages, state.currentPage + 1), state.currentPage === totalPages, false);
};

const renderStats = (totalItems) => {
  totalStudentsEl.dataset.count = totalItems.toString();
  animateCounter(totalStudentsEl, totalItems, true);
};

const renderPaginationInfo = (totalItems) => {
  if (totalItems === 0) {
    paginationInfoEl.textContent = "Showing 0 entries";
    return;
  }
  const startIndex = (state.currentPage - 1) * state.pageSize + 1;
  const endIndex = Math.min(state.currentPage * state.pageSize, totalItems);
  paginationInfoEl.textContent = `Showing ${startIndex}-${endIndex} of ${totalItems} entries`;
};

const render = () => {
  const filteredStudents = getFilteredSortedStudents();
  const totalItems = filteredStudents.length;

  renderStats(state.students.length);
  renderPagination(totalItems);
  renderPaginationInfo(totalItems);

  const start = (state.currentPage - 1) * state.pageSize;
  const currentPageStudents = filteredStudents.slice(start, start + state.pageSize);
  renderTable(currentPageStudents);

  emptyStateEl.classList.toggle("d-none", totalItems !== 0);
};

// ---- Scroll Reveal & Counters ----
const revealElements = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      const counters = entry.target.querySelectorAll("[data-count]");
      counters.forEach((counter) => {
        const target = Number(counter.dataset.count);
        if (!Number.isNaN(target)) {
          animateCounter(counter, target);
        }
      });
      observer.unobserve(entry.target);
    });
  },
  { threshold: 0.2 }
);

revealElements.forEach((element) => revealObserver.observe(element));

// ---- Event Handlers ----
searchInputEl.addEventListener("input", (event) => {
  state.searchTerm = event.target.value;
  state.currentPage = 1;
  render();
});

sortFieldEl.addEventListener("change", (event) => {
  state.sortField = event.target.value;
  render();
});

sortOrderEl.addEventListener("change", (event) => {
  state.sortOrder = event.target.value;
  render();
});

pageSizeEl.addEventListener("change", (event) => {
  state.pageSize = Number(event.target.value);
  state.currentPage = 1;
  render();
});

addStudentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(addStudentForm);
  createStudent({
    firstName: formData.get("firstName").trim(),
    lastName: formData.get("lastName").trim(),
    email: formData.get("email").trim(),
  });
});

editStudentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(editStudentForm);
  updateStudent(formData.get("id"), {
    firstName: formData.get("firstName").trim(),
    lastName: formData.get("lastName").trim(),
    email: formData.get("email").trim(),
  });
});

tableBodyEl.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) return;

  const student = state.students.find((item) => item.id.toString() === id);
  if (!student) return;

  if (action === "edit") {
    editStudentForm.elements.id.value = student.id;
    editStudentForm.elements.firstName.value = student.firstName;
    editStudentForm.elements.lastName.value = student.lastName;
    editStudentForm.elements.email.value = student.email;
    editStudentModal.show();
  }

  if (action === "delete") {
    deleteTargetId = student.id;
    deleteStudentMessage.textContent = `Are you sure you want to delete ${student.firstName} ${student.lastName}?`;
    deleteStudentModal.show();
  }
});

confirmDeleteButton.addEventListener("click", () => {
  if (deleteTargetId === null) return;
  deleteStudent(deleteTargetId);
});

addStudentModalEl.addEventListener("hidden.bs.modal", () => addStudentForm.reset());

// ---- Initial Load ----
fetchStudents();

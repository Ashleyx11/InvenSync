//states etc
const STORAGE_KEYS = {
  ITEMS: "inv_items",
  SALES: "inv_sales",
  SETTINGS: "inv_settings",
};

const defaultItems = [
  { id: 1, name: "Espresso Beans 1kg", category: "Beverage", stock: 50, price: 520 },
  { id: 2, name: "Whole Milk 1L", category: "Dairy", stock: 12, price: 88 },
  { id: 3, name: "Chocolate Syrup", category: "Condiments", stock: 6, price: 150 },
  { id: 4, name: "Paper Cups (100s)", category: "Packaging", stock: 3, price: 180 },
  { id: 5, name: "Green Tea Bags", category: "Beverage", stock: 22, price: 95 },
];

const defaultSales = []; //id, item_id, qty, total, sold_at
const defaultSettings = { threshold: 5, theme: "dark" };

let items = JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) || "null") || defaultItems;
let sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES) || "null") || defaultSales;
let settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || "null") || defaultSettings;

function persist() {
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

//helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function money(n) { return "₱" + Number(n).toFixed(2); }

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(()=> el.classList.add("hidden"), 1800);
}

//navigation
const sections = {
  dashboard: $("#section-dashboard"),
  inventory: $("#section-inventory"),
  sales: $("#section-sales"),
  reports: $("#section-reports"),
  settings: $("#section-settings"),
};
function showSection(key) {
  Object.values(sections).forEach(s => s.classList.add("hidden"));
  sections[key].classList.remove("hidden");
}
$$(".nav-btn").forEach(btn=>{
  btn.addEventListener("click", ()=> showSection(btn.dataset.section));
});
$("#openSidebar")?.addEventListener("click", ()=> toast("Use the left sidebar on larger screens."));

//theme
const rootBody = document.body;
function applyTheme() {
  rootBody.classList.toggle("bg-white", settings.theme === "light");
  rootBody.classList.toggle("text-slate-900", settings.theme === "light");
  rootBody.classList.toggle("bg-slate-900", settings.theme !== "light");
  rootBody.classList.toggle("text-slate-100", settings.theme !== "light");
}
applyTheme();
$("#toggleTheme").addEventListener("click", ()=>{
  settings.theme = settings.theme === "light" ? "dark" : "light";
  applyTheme(); persist();
});

//charts dashboard
let salesChart;
function dashboardMetrics() {
  const totalItems = items.reduce((a,c)=> a + c.stock, 0);
  const low = items.filter(i => i.stock <= settings.threshold && i.stock > 0).length;
  const today = new Date().toISOString().slice(0,10);
  const todaySales = sales.filter(s => s.sold_at.startsWith(today))
                          .reduce((a,c)=> a + c.total, 0);
  $("#metricTotalItems").textContent = totalItems;
  $("#metricLowStock").textContent = low;
  $("#metricSalesToday").textContent = money(todaySales);

  //last 7 days top items
  const map = {};
  const weekAgo = new Date(Date.now() - 6*24*3600*1000);
  sales.filter(s => new Date(s.sold_at) >= weekAgo).forEach(s=>{
    const item = items.find(i=>i.id===s.item_id);
    if (!item) return;
    map[item.name] = (map[item.name] || 0) + s.qty;
  });
  const list = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const ul = $("#topItems"); ul.innerHTML = "";
  list.forEach(([name, qty])=>{
    const li = document.createElement("li");
    li.textContent = `${name} — ${qty} sold`;
    ul.appendChild(li);
  });

  // 7-day sales chart (sum per day)
  const labels = [...Array(7)].map((_,i)=>{
    const d = new Date(Date.now() - (6-i)*24*3600*1000);
    return d.toLocaleDateString(undefined,{month:"short", day:"2-digit"});
  });
  const series = [...Array(7)].map((_,i)=>{
    const date = new Date(Date.now() - (6-i)*24*3600*1000).toISOString().slice(0,10);
    return sales.filter(s=> s.sold_at.startsWith(date)).reduce((a,c)=> a + c.total, 0);
  });

  const ctx = $("#salesChart").getContext("2d");
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Sales (₱)",
        data: series,
        borderColor: "#22d3ee",
        backgroundColor: "rgba(99,102,241,.15)",
        fill: true,
        tension: .35
      }]
    },
    options: { plugins:{ legend:{ display:false }}, scales:{ y:{ beginAtZero:true }}}
  });
}

//inventory rendering etc
const tableBody = $("#inventoryTable");
const invSearch = $("#invSearch");
const invCategory = $("#invCategory");
const pageInfo = $("#pageInfo");
const prevPage = $("#prevPage");
const nextPage = $("#nextPage");
let sortKey = "name";
let sortDir = "asc";
let page = 1;
const PAGE_SIZE = 7;

function buildCategories() {
  const cats = [...new Set(items.map(i=>i.category))].sort();
  invCategory.innerHTML = `<option value="">All Categories</option>` + 
    cats.map(c=>`<option>${c}</option>`).join("");
}

function filteredItems() {
  const q = (invSearch.value || "").toLowerCase();
  const cat = invCategory.value || "";
  return items.filter(i=>{
    const matchQ = (i.name + " " + i.category).toLowerCase().includes(q);
    const matchC = cat ? i.category === cat : true;
    return matchQ && matchC;
  });
}

function sortItems(list) {
  return list.sort((a,b)=>{
    let va=a[sortKey], vb=b[sortKey];
    if (typeof va==='string') { va=va.toLowerCase(); vb=vb.toLowerCase(); }
    const res = va>vb?1:va<vb?-1:0;
    return sortDir==='asc'?res:-res;
  });
}

function paginate(list) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(1, page), pages);
  const start = (page-1)*PAGE_SIZE;
  pageInfo.textContent = `Page ${page} of ${pages} • ${total} items`;
  prevPage.disabled = page===1;
  nextPage.disabled = page===pages;
  return list.slice(start, start+PAGE_SIZE);
}

function statusLabel(stock) {
  if (stock === 0) return `<span class="text-red-400">Out</span>`;
  if (stock <= settings.threshold) return `<span class="text-amber-300">Low</span>`;
  return `<span class="text-emerald-300">OK</span>`;
}

function renderInventory() {
  const data = paginate(sortItems(filteredItems()));
  tableBody.innerHTML = "";
  data.forEach(i=>{
    const tr = document.createElement("tr");
    tr.className = i.stock === 0 ? "critical-row" : (i.stock <= settings.threshold ? "low-row" : "");
    tr.innerHTML = `
      <td class="td">${i.name}</td>
      <td class="td">${i.category}</td>
      <td class="td text-right">${i.stock}</td>
      <td class="td text-right">${money(i.price)}</td>
      <td class="td">${statusLabel(i.stock)}</td>
      <td class="td">
        <button class="text-indigo-300 hover:underline mr-3" data-edit="${i.id}">Edit</button>
        <button class="text-red-300 hover:underline mr-3" data-del="${i.id}">Delete</button>
        <button class="text-emerald-300 hover:underline" data-restock="${i.id}">Restock</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
  dashboardMetrics();
  reportsPanel();
  saleItemsRefresh();
}

//sorting
$$(".sortable").forEach(th=>{
  th.addEventListener("click", ()=>{
    const key = th.dataset.sort;
    if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortKey = key; sortDir = "asc"; }
    renderInventory();
  });
});

//filters
invSearch.addEventListener("input", ()=>{ page=1; renderInventory(); });
invCategory.addEventListener("change", ()=>{ page=1; renderInventory(); });
prevPage.addEventListener("click", ()=>{ page--; renderInventory(); });
nextPage.addEventListener("click", ()=>{ page++; renderInventory(); });

//add or edit
const modal = $("#modal");
const modalTitle = $("#modalTitle");
const cancelModal = $("#cancelModal");
const itemForm = $("#itemForm");
const itemId = $("#itemId");
const itemName = $("#itemName");
const itemCategory = $("#itemCategory");
const itemStock = $("#itemStock");
const itemPrice = $("#itemPrice");

function openModal(edit=null) {
  modal.classList.remove("hidden");
  if (edit) {
    modalTitle.textContent = "Edit Item";
    itemId.value = edit.id;
    itemName.value = edit.name;
    itemCategory.value = edit.category;
    itemStock.value = edit.stock;
    itemPrice.value = edit.price;
  } else {
    modalTitle.textContent = "Add Item";
    itemForm.reset();
    itemId.value = "";
  }
}
function closeModal(){ modal.classList.add("hidden"); }

$("#addItem").addEventListener("click", ()=> openModal());
$("#addItemTop").addEventListener("click", ()=> openModal());
cancelModal.addEventListener("click", closeModal);

tableBody.addEventListener("click", (e)=>{
  const id = Number(e.target.dataset.edit || e.target.dataset.del || e.target.dataset.restock);
  if (!id) return;

  if (e.target.dataset.edit) {
    const data = items.find(x=>x.id===id);
    openModal(data);
  }
  if (e.target.dataset.del) {
    if (!confirm("Delete this item?")) return;
    items = items.filter(x=>x.id!==id);
    persist(); buildCategories(); renderInventory(); toast("Item deleted");
  }
  if (e.target.dataset.restock) {
    const amt = Number(prompt("Add quantity (restock):", "10") || "0");
    if (amt>0) {
      const it = items.find(x=>x.id===id);
      it.stock += amt;
      persist(); renderInventory(); toast("Restocked");
    }
  }
});

itemForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const payload = {
    name: itemName.value.trim(),
    category: itemCategory.value.trim(),
    stock: Number(itemStock.value),
    price: Number(itemPrice.value)
  };
  if (!payload.name || !payload.category || payload.stock<0 || payload.price<0) return;

  if (itemId.value) {
    const it = items.find(x=>x.id===Number(itemId.value));
    Object.assign(it, payload);
    toast("Item updated");
  } else {
    const id = (items.at(-1)?.id || 0) + 1;
    items.push({ id, ...payload });
    toast("Item added");
  }
  persist(); buildCategories(); renderInventory(); closeModal();
});

//sales
const saleForm = $("#saleForm");
const saleItem = $("#saleItem");
const saleQty = $("#saleQty");
const recentSales = $("#recentSales");

function saleItemsRefresh() {
  saleItem.innerHTML = "";

  if (items.length === 0) {
    saleItem.innerHTML = `<option disabled>No items in inventory</option>`;
    return;
  }

  items.forEach(i=>{
    const opt = document.createElement("option");
    opt.value = i.id;
    opt.textContent = `${i.name} (${i.stock} in stock)`;
    if (i.stock === 0) {
      opt.disabled = true; //prevent selling items with 0 stock
    }
    saleItem.appendChild(opt);
  });
}

saleForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const item_id = Number(saleItem.value);
  const qty = Number(saleQty.value);
  const it = items.find(i=>i.id===item_id);
  if (!it) return;
  if (qty<=0) return alert("Invalid quantity");
  if (it.stock < qty) return alert("Insufficient stock");

  it.stock -= qty;
  const total = qty * it.price;
  sales.unshift({ id: Date.now(), item_id, qty, total, sold_at: new Date().toISOString() });
  persist(); renderInventory();

  const li = document.createElement("li");
  li.textContent = `Sold ${qty} × ${it.name} — ${money(total)}`;
  recentSales.prepend(li);
  saleForm.reset();
  toast("Sale recorded");
});


//reports
function reportsPanel() {
  // Inventory value
  const value = items.reduce((a,c)=> a + c.stock * c.price, 0);
  $("#invValue").textContent = money(value);

  //low stock list
  const low = items.filter(i=> i.stock>0 && i.stock <= settings.threshold).sort((a,b)=>a.stock-b.stock);
  const ul = $("#lowList"); ul.innerHTML = "";
  if (low.length===0) {
    const li = document.createElement("li"); li.textContent = "No low-stock items.";
    ul.appendChild(li);
  } else {
    low.forEach(i=>{
      const li = document.createElement("li");
      li.innerHTML = `${i.name} — ${i.stock} left`;
      ul.appendChild(li);
    });
  }
}

//settings
$("#threshold").value = settings.threshold;
$("#saveSettings").addEventListener("click", ()=>{
  settings.threshold = Number($("#threshold").value) || 5;
  persist(); renderInventory(); toast("Settings saved");
});

//globalsearch
$("#globalSearch").addEventListener("input", (e)=>{
  const q = e.target.value.trim().toLowerCase();
  showSection("inventory");
  invSearch.value = q;
  page = 1; renderInventory();
});

//boot
function init() {
  buildCategories();
  renderInventory();
  dashboardMetrics();
  reportsPanel();
  showSection("dashboard");
}
init();

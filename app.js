// app.js (versão offline-first)
// Nota: para activar o service worker serve a pasta por HTTP (ex.: python -m http.server)

const IVA_DEFAULT = 0.23; // 23% IVA como exemplo

let products = [];
let cart = [];
let scenarios = [
  { id:1, title:'Cenário 1 — Caixa rápida', desc:'Regista 5 itens e cobre com dinheiro. Troco exacto.', timeSec:120, targetItems:5 }
];

const PRODUCTS_LS_KEY = 'oc_products_cache';

// Bannner online/offline
function setOfflineBanner(isOffline){
  const b = document.getElementById('offlineBanner');
  if(!b) return;
  if(isOffline) b.classList.remove('hidden'); else b.classList.add('hidden');
}

// Tenta carregar products.json (HTTP). Se falhar, usa localStorage ou fallback embutido.
async function loadProducts(){
  try{
    // Tenta obter via fetch — se o SW estiver activo, será servido do cache quando offline.
    const resp = await fetch('products.json', {cache: "no-cache"});
    if(!resp.ok) throw new Error('no products.json');
    const p = await resp.json();
    products = p;
    // guarda em localStorage para uso offline sem SW (file://) ou para fallback
    try { localStorage.setItem(PRODUCTS_LS_KEY, JSON.stringify(products)); } catch(e){}
  }catch(e){
    // tentar carregar do localStorage
    const cached = localStorage.getItem(PRODUCTS_LS_KEY);
    if(cached){
      try { products = JSON.parse(cached); console.info('Produtos carregados do localStorage'); renderProductList(products); return; } catch(e){}
    }
    // fallback embutido
    products = [
      { code:'1001', name:'Água 1L', price:0.80, iva:0.23 },
      { code:'1002', name:'Pão', price:0.85, iva:0.06 },
      { code:'1003', name:'Leite 1L', price:1.10, iva:0.23 },
      { code:'1004', name:'Chocolate', price:1.50, iva:0.23 },
      { code:'2001', name:'Maçã (un)', price:0.35, iva:0.06 },
      { code:'3001', name:'Café (pequeno)', price:1.20, iva:0.23 },
      { code:'4001', name:'Jornal', price:1.00, iva:0.06 },
    ];
  }
  renderProductList(products);
}

function $(sel){ return document.querySelector(sel) }
function $all(sel){ return Array.from(document.querySelectorAll(sel)) }

function renderProductList(list){
  const el = $('#productList');
  el.innerHTML = '';
  list.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'product-item';
    div.innerHTML = `<div><strong>${p.code}</strong> — ${p.name} <small style="color:#666">€${p.price.toFixed(2)}</small></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Adicionar';
    btn.onclick = ()=> addToCart(p.code);
    div.appendChild(btn);
    el.appendChild(div);
  });
}

function addToCart(code){
  const prod = products.find(p=>p.code==code);
  if(!prod) return alert('Produto não encontrado');
  const existing = cart.find(c=>c.code==code);
  if(existing){ existing.qty++; }
  else{ cart.push({ ...prod, qty:1 }); }
  renderCart();
}

function renderCart(){
  const tbody = $('#cartTable tbody');
  tbody.innerHTML = '';
  cart.forEach((it, idx)=>{
    const row = document.createElement('tr');
    const subtotal = (it.price * it.qty);
    row.innerHTML = `
      <td>${idx+1}</td>
      <td>${it.name}</td>
      <td><input type="number" min="1" value="${it.qty}" data-idx="${idx}" class="qty" style="width:60px"></td>
      <td>€${it.price.toFixed(2)}</td>
      <td>${(it.iva||IVA_DEFAULT)*100}%</td>
      <td>€${(subtotal).toFixed(2)}</td>
      <td><button data-idx="${idx}" class="btn outline remove">Remover</button></td>
    `;
    tbody.appendChild(row);
  });
  $all('.qty').forEach(el=>{
    el.onchange = (e)=>{
      const idx = e.target.dataset.idx;
      const v = parseInt(e.target.value)||1;
      cart[idx].qty = v;
      renderCart();
    }
  });
  $all('.remove').forEach(b=>{
    b.onclick = ()=> { cart.splice(+b.dataset.idx,1); renderCart(); }
  });
  updateTotals();
}

function updateTotals(){
  let subtotal=0, ivaTotal=0;
  cart.forEach(it=>{
    const s = it.price * it.qty;
    const iva = (it.iva||IVA_DEFAULT) * s;
    subtotal += s;
    ivaTotal += iva;
  });
  const total = subtotal + ivaTotal;
  $('#subtotal').textContent = `€${subtotal.toFixed(2)}`;
  $('#iva').textContent = `€${ivaTotal.toFixed(2)}`;
  $('#total').textContent = `€${total.toFixed(2)}`;
  // update change calculation if needed
  const payMethod = document.querySelector('input[name="payMethod"]:checked').value;
  if(payMethod === 'cash'){
    const received = parseFloat($('#cashReceived').value) || 0;
    $('#change').textContent = `€${Math.max(0, (received - total)).toFixed(2)}`;
  } else {
    $('#change').textContent = `€0.00`;
  }
}

function findByQuery(q){
  q = q.trim().toLowerCase();
  if(!q) return products;
  return products.filter(p=> p.code.includes(q) || p.name.toLowerCase().includes(q));
}

function setupUI(){
  $('#searchInput').addEventListener('input', e=>{
    renderProductList(findByQuery(e.target.value));
  });

  $('#clearCart').onclick = ()=>{
    if(!confirm('Limpar carrinho?')) return;
    cart = []; renderCart();
  };

  $all('input[name="payMethod"]').forEach(r=>{
    r.onchange = ()=>{
      if(r.value==='cash' && r.checked){ $('#cashPayment').classList.remove('hidden'); $('#cardPayment').classList.add('hidden'); }
      if(r.value==='card' && r.checked){ $('#cashPayment').classList.add('hidden'); $('#cardPayment').classList.remove('hidden'); }
    }
  });

  $('#cashReceived').addEventListener('input', updateTotals);

  $('#completeCash').onclick = ()=>{
    const total = parseFloat($('#total').textContent.replace('€',''))||0;
    const received = parseFloat($('#cashReceived').value) || 0;
    if(received < total) return alert('Valor recebido é inferior ao total.');
    const change = (received - total).toFixed(2);
    $('#evalResult').classList.remove('hidden');
    $('#evalResult').textContent = `Pagamento registado. Troco: €${change}. Sessão salva automaticamente.`;
    saveSession({ type:'cash', received, change, total, cart:JSON.parse(JSON.stringify(cart)), timestamp:Date.now() });
    cart = []; renderCart();
  };

  $('#completeCard').onclick = ()=>{
    const total = parseFloat($('#total').textContent.replace('€',''))||0;
    $('#evalResult').classList.remove('hidden');
    $('#evalResult').textContent = `Pagamento por cartão registado. Total: €${total.toFixed(2)}. Sessão salva automaticamente.`;
    saveSession({ type:'card', total, cart:JSON.parse(JSON.stringify(cart)), timestamp:Date.now() });
    cart = []; renderCart();
  };

  $('#printReceipt').onclick = ()=> printReceipt();
  $('#saveSession').onclick = ()=> saveSession({ type:'manual', total: parseFloat($('#total').textContent.replace('€',''))||0, cart:JSON.parse(JSON.stringify(cart)), timestamp:Date.now() });
  $('#openScenarios').onclick = ()=> openScenarios();
  $('#closeScenarios').onclick = ()=> closeScenarios();

  renderScenariosList();
  renderHistory();

  // online/offline
  setOfflineBanner(!navigator.onLine);
  window.addEventListener('online', ()=> setOfflineBanner(false));
  window.addEventListener('offline', ()=> setOfflineBanner(true));
}

function printReceipt(){
  const total = $('#total').textContent;
  const lines = cart.map(it=> `${it.qty}x ${it.name} @€${it.price.toFixed(2)} = €${(it.qty*it.price).toFixed(2)}`).join('\n');
  const html = `
    <div style="font-family:Arial;padding:16px">
      <h3>Recibo (Treino)</h3>
      <pre>${lines}</pre>
      <p>Total: <strong>${total}</strong></p>
      <p>Gerado em: ${new Date().toLocaleString()}</p>
    </div>
  `;
  const receiptEl = $('#receipt');
  receiptEl.innerHTML = html;
  receiptEl.classList.remove('hidden');
  window.print();
  setTimeout(()=> receiptEl.classList.add('hidden'), 800);
}

function saveSession(data){
  const stored = JSON.parse(localStorage.getItem('oc_sessions')||'[]');
  stored.unshift(data);
  localStorage.setItem('oc_sessions', JSON.stringify(stored.slice(0,50)));
  renderHistory();
}

function renderHistory(){
  const list = JSON.parse(localStorage.getItem('oc_sessions')||'[]');
  const el = $('#historyList');
  if(!list.length){ el.innerHTML = '<p>Sem sessões guardadas.</p>'; return; }
  el.innerHTML = '';
  list.forEach((s, idx)=>{
    const div = document.createElement('div');
    div.className = 'card';
    div.style.marginBottom='8px';
    div.innerHTML = `<strong>${s.type || 'sessão'}</strong> — ${new Date(s.timestamp).toLocaleString()} — Total: €${(s.total||0).toFixed(2)} <button data-idx="${idx}" class="btn outline small">Ver</button>`;
    el.appendChild(div);
  });
  $all('#historyList .small').forEach(b=>{
    b.onclick = ()=> {
      const idx = b.dataset.idx;
      const list = JSON.parse(localStorage.getItem('oc_sessions')||'[]');
      const s = list[idx];
      alert(JSON.stringify(s, null, 2));
    }
  });
}

function renderScenariosList(){
  const el = $('#scenariosList');
  el.innerHTML = '';
  scenarios.forEach(s=>{
    const d = document.createElement('div');
    d.className = 'card';
    d.style.marginBottom='8px';
    d.innerHTML = `<strong>${s.title}</strong><p>${s.desc}</p><p>Tempo: ${s.timeSec}s • Objetivo: ${s.targetItems} itens</p><button class="btn" data-id="${s.id}">Iniciar</button>`;
    el.appendChild(d);
  });
  $all('#scenariosList .btn').forEach(b=>{
    b.onclick = ()=> startScenario(+b.dataset.id);
  });
}

let scenarioTimer = null;
let scenarioState = null;

function openScenarios(){ $('#scenariosModal').classList.remove('hidden'); }
function closeScenarios(){ $('#scenariosModal').classList.add('hidden'); }

function startScenario(id){
  const s = scenarios.find(x=>x.id==id);
  if(!s) return;
  if(!confirm(`Iniciar "${s.title}"?`)) return;
  closeScenarios();
  cart = [];
  renderCart();
  scenarioState = { scenarioId:id, start:Date.now(), timeLeft: s.timeSec, targetItems:s.targetItems };
  scenarioTimer = setInterval(()=>{
    scenarioState.timeLeft--;
    if(scenarioState.timeLeft <=0){
      clearInterval(scenarioTimer);
      finishScenario();
    }
  },1000);
  alert(`Cenário iniciado: tens ${s.timeSec} segundos. Completa o objetivo e regista o pagamento.`);
}

function finishScenario(){
  const s = scenarios.find(x=>x.id==scenarioState.scenarioId);
  const items = cart.reduce((a,b)=>a+b.qty,0);
  const total = cart.reduce((a,b)=>a + b.qty*b.price*(1+(b.iva||IVA_DEFAULT)),0);
  let score = 0;
  if(items >= s.targetItems) score += 60;
  const elapsed = (Date.now() - scenarioState.start)/1000;
  if(elapsed <= s.timeSec) score += 40;
  const msg = `Cenário terminado.\nItens registados: ${items}\nTotal (com IVA): €${total.toFixed(2)}\nPontuação: ${score}/100`;
  alert(msg);
  saveSession({ type:'scenario', scenarioId:s.id, items, total, score, timestamp:Date.now() });
  cart = []; renderCart();
  scenarioState = null;
}

// Inicialização
(async function init(){
  await loadProducts();
  setupUI();
})();

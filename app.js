import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA605ZGWKUyLfwe9-OohNRwnCqSV23q_cM",
    authDomain: "estocaai-87cb7.firebaseapp.com",
    projectId: "estocaai-87cb7",
    storageBucket: "estocaai-87cb7.firebasestorage.app",
    messagingSenderId: "277900152962",
    appId: "1:277900152962:web:334527ff846d773a27249b",
    measurementId: "G-4ZKFCF6XPE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnStartScan = document.getElementById('btn-start-scan');
const btnExport = document.getElementById('btn-export');
const btnExportMes = document.getElementById('btn-export-mes'); 
const scanResult = document.getElementById('scan-result');
const tabelaCorpo = document.getElementById('tabela-corpo');
const tituloTabela = document.getElementById('titulo-tabela');
const inputObservacao = document.getElementById('observacao');
const btnSalvarObs = document.getElementById('btn-salvar-obs');
const loginMsg = document.getElementById('login-msg');

const selectArea = document.getElementById('area');
const selectMes = document.getElementById('mes');
const selectAno = document.getElementById('ano');

let inventarioParaExcel = [];
let observacaoTemporaria = "";
let ultimoIdSalvo = null;
let ultimoCodigoLido = "";
let ultimaLeituraTempo = 0;
let html5QrcodeScanner = null;


onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        carregarDadosDoBanco();
    } else {
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});


btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!email || !password) { if (loginMsg) loginMsg.innerText = "Preencha o e-mail e a senha!"; return; }
    try {
        if (loginMsg) loginMsg.innerText = "Entrando...";
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) { if (loginMsg) loginMsg.innerText = "E-mail ou senha incorretos."; }
});

btnLogout.addEventListener('click', async () => {
    if (html5QrcodeScanner) { await html5QrcodeScanner.clear(); html5QrcodeScanner = null; }
    await signOut(auth);
});

selectArea.addEventListener('change', carregarDadosDoBanco);
selectMes.addEventListener('change', carregarDadosDoBanco);
selectAno.addEventListener('change', carregarDadosDoBanco);


btnSalvarObs.addEventListener('click', async () => {
    const textoObs = inputObservacao.value.trim();
    if (textoObs !== "") {
        if (ultimoIdSalvo) {
            try {
                await updateDoc(doc(db, "inventario", ultimoIdSalvo), { observacao: textoObs });
                scanResult.innerText = `Observação atualizada!`;
                scanResult.style.color = "#0b6623";
                inputObservacao.value = "";
                ultimoIdSalvo = null;
                carregarDadosDoBanco();
                return;
            } catch (e) { console.error(e); }
        }
        observacaoTemporaria = textoObs;
        scanResult.innerText = `Obs fixada para o próximo: "${observacaoTemporaria}"`;
        scanResult.style.color = "blue";
    }
});


btnStartScan.addEventListener('click', () => {
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 15, qrbox: { width: 280, height: 280 }, aspectRatio: 1.0 }, false);
        html5QrcodeScanner.render(onScanSuccess, (err) => {});
        btnStartScan.innerText = "Desligar Câmera";
    } else {
        html5QrcodeScanner.clear().then(() => { html5QrcodeScanner = null; btnStartScan.innerText = "Ligar Câmera"; });
    }
});

function tocarBipSucesso() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.connect(gainNode); gainNode.connect(audioCtx.destination);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
}

async function onScanSuccess(decodedText) {
    const agora = Date.now();
    if (decodedText === ultimoCodigoLido && (agora - ultimaLeituraTempo) < 3000) return;
    ultimoCodigoLido = decodedText; ultimaLeituraTempo = agora;

    let partes = [];
    if (decodedText.includes("|")) { partes = decodedText.split("|"); } 
    else if (decodedText.includes(";")) { partes = decodedText.split(";"); } 
    else { partes = decodedText.split(/\r?\n/); }

    const itemData = {
        codigo: partes[0] ? partes[0].trim() : decodedText,
        descricao: partes[1] ? partes[1].trim() : "Não identificada",
        fornecedor: partes[2] ? partes[2].trim() : "",
        lote: partes[3] ? partes[3].trim() : "",
        notaFiscal: partes[4] ? partes[4].trim() : "",
        quantidade: partes[5] ? partes[5].trim() : "",
        sie: partes[6] ? partes[6].trim() : "",
        dataQr: partes[7] ? partes[7].trim() : "",
        observacao: inputObservacao.value.trim() || observacaoTemporaria || "",
        area: selectArea.value,
        mes: selectMes.value,
        ano: selectAno.value,
        dataRegistro: new Date()
    };

    try {
        const docRef = await addDoc(collection(db, "inventario"), itemData);
        ultimoIdSalvo = docRef.id; observacaoTemporaria = ""; inputObservacao.value = "";
        tocarBipSucesso();
        scanResult.innerHTML = `✅ <b>ESCANEADO!</b><br>${itemData.codigo} - ${itemData.descricao}`;
        scanResult.style.color = "#0b6623";
        carregarDadosDoBanco();
    } catch (e) { scanResult.innerText = "Erro ao salvar!"; scanResult.style.color = "red"; }
}


btnExportMes.addEventListener('click', async () => {
    const mesSelecionado = selectMes.value;
    const anoSelecionado = selectAno.value;
    try {
        scanResult.innerText = `Gerando relatório de todo o mês...`;
        const q = query(collection(db, "inventario"), where("mes", "==", mesSelecionado), where("ano", "==", anoSelecionado));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { alert("Nenhum registro encontrado!"); scanResult.innerText = ""; return; }

        let dadosMensais = [];
        snapshot.forEach(docSnap => {
            const item = docSnap.data();
            dadosMensais.push({ "Área": item.area, "Código": item.codigo, "Descrição": item.descricao, "Fornecedor": item.fornecedor, "Lote": item.lote, "Nota Fiscal": item.notaFiscal, "Quantidade": item.quantidade, "SIE n°": item.sie, "Data": item.dataQr, "Observação": item.observacao || "-" });
        });

        const ws = XLSX.utils.json_to_sheet(dadosMensais);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Mes_${mesSelecionado}`);
        XLSX.writeFile(wb, `Inventario_Geral_${mesSelecionado}_${anoSelecionado}.xlsx`);
        scanResult.innerText = `✅ Relatório mensal gerado!`;
    } catch (err) { scanResult.innerText = "Erro ao gerar relatório."; }
});


btnExport.addEventListener('click', () => {
    if (inventarioParaExcel.length === 0) { alert("Nenhum dado!"); return; }
    const ws = XLSX.utils.json_to_sheet(inventarioParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `Inventario_${selectArea.value}_${selectMes.value}_${selectAno.value}.xlsx`);
});

function adicionarNaTabela(idDoc, item) {
    const obs = item.observacao || "-";
    inventarioParaExcel.push({ "Código": item.codigo, "Descrição": item.descricao, "Fornecedor": item.fornecedor, "Lote": item.lote, "Nota Fiscal": item.notaFiscal, "Quantidade": item.quantidade, "SIE n°": item.sie, "Data": item.dataQr, "Observação": obs });
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.codigo}</td><td>${item.descricao}</td><td>${item.fornecedor}</td><td>${item.lote}</td><td>${item.notaFiscal}</td><td>${item.quantidade}</td><td>${item.sie}</td><td>${item.dataQr}</td><td>${obs}</td><td><button class="btn-delete" data-id="${idDoc}">Excluir</button></td>`;
    tr.querySelector('.btn-delete').addEventListener('click', async () => { if (confirm("Confirmar exclusão?")) { await deleteDoc(doc(db, "inventario", idDoc)); carregarDadosDoBanco(); } });
    tabelaCorpo.appendChild(tr);
}

async function carregarDadosDoBanco() {
    tabelaCorpo.innerHTML = ""; inventarioParaExcel = [];
    tituloTabela.innerText = `Registros: ${selectArea.value} (${selectMes.value}/${selectAno.value})`;
    try {
        const q = query(collection(db, "inventario"), where("area", "==", selectArea.value), where("mes", "==", selectMes.value), where("ano", "==", selectAno.value));
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => adicionarNaTabela(docSnap.id, docSnap.data()));
    } catch (err) { console.error(err); }
}
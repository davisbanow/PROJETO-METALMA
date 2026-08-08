import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const scanResult = document.getElementById('scan-result');
const tabelaCorpo = document.getElementById('tabela-corpo');
const tituloTabela = document.getElementById('titulo-tabela');
const inputObservacao = document.getElementById('observacao');
const btnSalvarObs = document.getElementById('btn-salvar-obs');

const selectArea = document.getElementById('area');
const selectMes = document.getElementById('mes');
const selectAno = document.getElementById('ano');

let inventarioParaExcel = [];
let observacaoTemporaria = "";

btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginMsg = document.getElementById('login-msg');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        if (loginMsg) loginMsg.innerText = "";
        carregarDadosDoBanco();
    } catch (error) {
        if (loginMsg) loginMsg.innerText = "E-mail ou senha incorretos. Verifique os dados.";
        console.error("Erro de Autenticação:", error);
    }
});

btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    loginScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
});

selectArea.addEventListener('change', carregarDadosDoBanco);
selectMes.addEventListener('change', carregarDadosDoBanco);
selectAno.addEventListener('change', carregarDadosDoBanco);

btnSalvarObs.addEventListener('click', () => {
    if (inputObservacao) {
        observacaoTemporaria = inputObservacao.value.trim();
        if (observacaoTemporaria !== "") {
            scanResult.innerText = `Observação fixada: "${observacaoTemporaria}"`;
            scanResult.style.color = "blue";
        } else {
            scanResult.innerText = `Nenhuma observação inserida para fixar.`;
            scanResult.style.color = "gray";
        }
    }
});

let html5QrcodeScanner;

btnStartScan.addEventListener('click', () => {
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 100} }, false);
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        btnStartScan.innerText = "Desligar Câmera";
    } else {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
        btnStartScan.innerText = "Ligar Câmera";
    }
});

async function onScanSuccess(decodedText, decodedResult) {
    if(decodedText.includes("-")) {
        const partes = decodedText.split("-");
        const codigo = partes[0];
        const peso = partes[1];

        const areaSelecionada = selectArea.value;
        const mesSelecionado = selectMes.value;
        const anoSelecionado = selectAno.value;
        
       
        const inputAtual = document.getElementById('observacao');
        const textoCaixa = inputAtual ? inputAtual.value.trim() : "";
        const obsFinal = textoCaixa !== "" ? textoCaixa : (observacaoTemporaria || "");

        scanResult.innerText = `Lido: Código ${codigo} | Peso ${peso}`;
        scanResult.style.color = "green";

        try {
         
            await addDoc(collection(db, "inventario"), {
                codigo: String(codigo),
                peso: String(peso),
                observacao: String(obsFinal),
                area: String(areaSelecionada),
                mes: String(mesSelecionado),
                ano: String(anoSelecionado),
                dataRegistro: new Date()
            });
            
          
            if (inputAtual) inputAtual.value = "";
            observacaoTemporaria = "";

          
            setTimeout(() => {
                carregarDadosDoBanco();
            }, 300);

        } catch (e) {
            console.error("Erro ao salvar no Firestore: ", e);
        }

        html5QrcodeScanner.pause(true);
        setTimeout(() => html5QrcodeScanner.resume(), 2000);
    } else {
        scanResult.innerText = "Formato de código inválido!";
        scanResult.style.color = "red";
    }
}

function onScanFailure(error) {}

function adicionarNaTabela(idDoc, codigo, peso, observacao) {
    const obsTratada = (observacao && observacao !== "undefined" && observacao !== "null") ? String(observacao).trim() : "";

    inventarioParaExcel.push({ 
        "Código": String(codigo), 
        "Peso": String(peso), 
        "Observação": obsTratada 
    });
    
    const novaLinha = document.createElement('tr');
    novaLinha.innerHTML = `
        <td>${codigo}</td>
        <td>${peso}</td>
        <td>${obsTratada !== "" ? obsTratada : "-"}</td>
        <td><button class="btn-delete" data-id="${idDoc}">Excluir</button></td>
    `;
    
    novaLinha.querySelector('.btn-delete').addEventListener('click', async () => {
        if (confirm("Tem certeza que deseja apagar este registro?")) {
            try {
                await deleteDoc(doc(db, "inventario", idDoc));
                carregarDadosDoBanco();
            } catch (error) {
                console.error("Erro ao excluir documento: ", error);
            }
        }
    });

    tabelaCorpo.appendChild(novaLinha);
}

async function carregarDadosDoBanco() {
    tabelaCorpo.innerHTML = "";
    inventarioParaExcel = [];

    const areaAtual = selectArea.value;
    const mesAtual = selectMes.value;
    const anoAtual = selectAno.value;

    tituloTabela.innerText = `Registros: ${areaAtual} (${mesAtual}/${anoAtual})`;

    try {
        const q = query(
            collection(db, "inventario"), 
            where("area", "==", areaAtual),
            where("mes", "==", mesAtual),
            where("ano", "==", anoAtual)
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            adicionarNaTabela(docSnap.id, item.codigo, item.peso, item.observacao);
        });
    } catch (error) {
        console.error("Erro ao buscar dados filtrados do banco: ", error);
    }
}

btnExport.addEventListener('click', () => {
    if (inventarioParaExcel.length === 0) {
        alert("Nenhum dado encontrado para exportar nesta área e período!");
        return;
    }

    const areaSelecionada = selectArea.value;
    const mesSelecionado = selectMes.value;
    const anoSelecionado = selectAno.value;

    const worksheet = XLSX.utils.json_to_sheet(inventarioParaExcel, { 
        header: ["Código", "Peso", "Observação"] 
    });
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    XLSX.writeFile(workbook, `Inventario_${areaSelecionada}_${mesSelecionado}_${anoSelecionado}.xlsx`);
});
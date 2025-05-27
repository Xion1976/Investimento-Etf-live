// --- Configurazione Iniziale (Deve corrispondere al server per i calcoli) ---
const ctx = document.getElementById('etfChart').getContext('2d');
const initialCapital = 10000;
const targetValue = 15000;
const simulationMonths = 5;
const simulationDays = simulationMonths * (365.25 / 12); // ~152.1875 giorni

const UPDATE_INTERVAL_MS = 60000; // Aggiornamento ogni 60 secondi

// --- Variabili di Stato (del frontend) ---
let currentValue = initialCapital; // Sarà aggiornato dal server
let simulatedDayCounter = 0; // Sarà aggiornato dal server
let dataPoints = [{ x: new Date(), y: initialCapital }]; // Inizializzato con dato base
let etfChart; // Global per il grafico
let prevValueForDisplay = initialCapital; // Per calcolare la variazione percentuale

// --- Funzioni di Utility ---
function updateDateTimeDisplay() {
  const now = new Date();
  document.getElementById('currentDateTime').textContent = 
    "Data e ora attuali: " + now.toLocaleString('it-IT', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
}

// --- Configurazione e Inizializzazione del Grafico ---
function initChart() {
  etfChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Valore ETF (€)',
        data: dataPoints,
        parsing: {
          xAxisKey: 'x',
          yAxisKey: 'y'
        },
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 3,
      }]
    },
    options: {
      animation: {
          duration: UPDATE_INTERVAL_MS / 4 
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'minute',
            tooltipFormat: 'dd/MM/yyyy HH:mm:ss',
            displayFormats: {
              minute: 'HH:mm',
              hour: 'HH:mm'
            }
          },
          ticks: { 
            color: '#94a3b8', 
            maxRotation: 0, 
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10 
          },
          title: { display: true, text: 'Tempo Live', color: '#94a3b8' },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)'
          }
        },
        y: {
          ticks: { 
            color: '#94a3b8', 
            callback: v => '€' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
          },
          title: { display: true, text: 'Valore (€)', color: '#94a3b8' },
          beginAtZero: false,
          grid: {
            color: 'rgba(148, 163, 184, 0.1)'
          }
        }
      },
      plugins: {
        legend: { 
          labels: { 
            color: '#f8fafc', 
            font: { size: 14, weight: 'bold' } 
          } 
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: ctx => `Valore: €${ctx.parsed.y.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
            title: function(tooltipItems) {
                return tooltipItems[0].label;
            }
          },
          backgroundColor: '#334155',
          bodyColor: '#f1f5f9',
          titleColor: '#38bdf8',
          borderColor: '#38bdf8',
          borderWidth: 1,
          padding: 10
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      }
    }
  });
}

// Aggiorna solo i valori della dashboard
function updateDashboardDisplay() {
  document.getElementById('currentValue').textContent = '€' + currentValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!isNaN(prevValueForDisplay) && prevValueForDisplay > 0 && currentValue !== prevValueForDisplay) {
      const changePercent = ((currentValue - prevValueForDisplay) / prevValueForDisplay) * 100;
      const changeAmount = currentValue - prevValueForDisplay;

      const percentElement = document.getElementById('secondChangePercent');
      const amountElement = document.getElementById('secondChangeAmount');

      percentElement.textContent = `${changePercent.toFixed(4)}%`;
      amountElement.textContent = `${changeAmount >= 0 ? '+' : ''}€${changeAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

      if (changePercent > 0) {
          percentElement.className = 'value-change positive';
          amountElement.className = 'value-change positive';
      } else if (changePercent < 0) {
          percentElement.className = 'value-change negative';
          amountElement.className = 'value-change negative';
      } else {
          percentElement.className = 'value-change neutral';
          amountElement.className = 'value-change neutral';
      }
  } else {
      document.getElementById('secondChangePercent').textContent = '0.0000%';
      document.getElementById('secondChangeAmount').textContent = '€0.00';
      document.getElementById('secondChangePercent').className = 'value-change neutral';
      document.getElementById('secondChangeAmount').className = 'value-change neutral';
  }
}

// Aggiorna solo lo stato dell'obiettivo
function updateGoalStatusDisplay() {
  if (currentValue >= targetValue) {
      document.getElementById('goalStatus').textContent = 'Obiettivo Raggiunto!';
      document.getElementById('goalStatus').style.color = '#22c55e';
  } else if (simulatedDayCounter >= simulationDays) {
      document.getElementById('goalStatus').textContent = 'Obiettivo non raggiunto in tempo!';
      document.getElementById('goalStatus').style.color = '#ef4444';
  } else {
      document.getElementById('goalStatus').textContent = `Monitoraggio (Giorno ${Math.floor(simulatedDayCounter)}/${Math.floor(simulationDays)})`;
      document.getElementById('goalStatus').style.color = '#f8fafc';
  }
}

// Funzione per recuperare lo stato dal server
async function fetchEtfStatus() {
    try {
        document.getElementById('debugStatus').textContent = `Stato: Recupero dati dal server...`;
        document.getElementById('debugStatus').style.color = 'yellow';

        const response = await fetch('/api/status'); // Chiama l'API del nostro backend
        if (!response.ok) {
            throw new Error(`Errore HTTP! Stato: ${response.status}`);
        }
        const data = await response.json();

        prevValueForDisplay = currentValue; // Salva il valore attuale prima di aggiornare
        currentValue = data.currentValue;
        simulatedDayCounter = data.simulatedDayCounter;

        // Aggiungi il nuovo punto al grafico, mantienine un numero limitato
        dataPoints.push({ x: new Date(data.lastUpdatedTimestamp), y: currentValue });
        const maxPoints = 60; // Ultima ora di dati (60 punti * 60s)
        if(dataPoints.length > maxPoints) {
            dataPoints.shift();
        }

        etfChart.data.datasets[0].data = dataPoints;
        etfChart.update('none');

        updateDashboardDisplay();
        updateGoalStatusDisplay();

        document.getElementById('debugStatus').textContent = `Stato: Dati aggiornati dal server.`;
        document.getElementById('debugStatus').style.color = '#22c55e'; // Verde per successo

    } catch (error) {
        console.error('Errore nel recupero dello stato ETF:', error);
        document.getElementById('debugStatus').textContent = `Errore: Non è stato possibile connettersi al server (${error.message}). Assicurati che il server sia in esecuzione.`;
        document.getElementById('debugStatus').style.color = '#ef4444'; // Rosso per errore
    }
}

// --- Avvio del Frontend ---
window.onload = () => {
  initChart();
  updateDateTimeDisplay();
  setInterval(updateDateTimeDisplay, 1000); // Aggiorna l'orario ogni secondo

  // Esegui subito il primo fetch per avere i dati iniziali
  fetchEtfStatus(); 

  // Poi esegui fetch ogni UPDATE_INTERVAL_MS (60 secondi)
  setInterval(fetchEtfStatus, UPDATE_INTERVAL_MS);
};


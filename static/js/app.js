// Frontend logic replacing localStorage with Flask API
document.addEventListener('DOMContentLoaded', async function () {
  const dailyConsumptionChart = createDailyConsumptionChart();
  const lineConsumptionChart = createLineConsumptionChart();
  const inventoryChart = createInventoryChart();
  const reorderChart = createReorderChart();

  showSection('tracker');
  document.querySelectorAll('.nav-dashboard').forEach(item => {
    item.addEventListener('click', function () {
      const section = this.getAttribute('data-section');
      showSection(section);
      document.querySelectorAll('.nav-dashboard').forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Handlers
  document.getElementById('consumptionForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const payload = {
      productionLine: document.getElementById('productionLine').value,
      shiftLeader: document.getElementById('shiftLeader').value,
      ripponAmount: document.getElementById('ripponAmount').value,
      labelAmount: document.getElementById('labelAmount').value,
      notes: document.getElementById('notes').value
    };
    if (!payload.productionLine || !payload.shiftLeader || payload.ripponAmount === '' || payload.labelAmount === '') {
      alert('Please fill all required fields');
      return;
    }
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      alert('Error saving record');
      return;
    }
    this.reset();
    await refreshAll();
  });

  document.getElementById('filterDate').addEventListener('change', updateHistoryTable);
  document.getElementById('filterLine').addEventListener('change', updateHistoryTable);
  document.getElementById('clearDateFilter').addEventListener('click', function () {
    document.getElementById('filterDate').value = '';
    updateHistoryTable();
  });

  async function refreshAll() {
    await loadRecentRecords();
    await updateStatisticsAndDashboard();
    await updateHistoryTable();
  }

  await refreshAll();

  // --- UI helpers ---
  function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
    const elem = document.getElementById(sectionId);
    if (elem) elem.style.display = 'block';
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    return res.json();
  }

  async function loadRecentRecords() {
    const records = await fetchJSON('/api/records');
    const tableBody = document.getElementById('consumptionTableBody');
    tableBody.innerHTML = '';
    records.slice(0, 5).forEach(record => addTableRow(tableBody, record));
  }

  function addTableRow(tableBody, record) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.timestamp}</td>
      <td>${record.line}</td>
      <td>${record.rippon}</td>
      <td>${record.labels}</td>
      <td>${record.shiftLeader}</td>
      <td>
        <button class="btn btn-sm btn-info view-details" data-notes="${record.notes || ''}">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-sm btn-danger delete-record" data-id="${record.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);

    row.querySelector('.view-details').addEventListener('click', function () {
      alert('Additional Notes: ' + (this.getAttribute('data-notes') || 'No notes provided'));
    });

    row.querySelector('.delete-record').addEventListener('click', async function () {
      if (!confirm('Are you sure you want to delete this record?')) return;
      const id = this.getAttribute('data-id');
      const res = await fetch('/api/records/' + id, { method: 'DELETE' });
      if (res.ok) {
        await refreshAll();
      } else {
        alert('Failed to delete');
      }
    });
  }

  async function updateStatisticsAndDashboard() {
    const stats = await fetchJSON('/api/stats');

    // Totals
    document.getElementById('totalRippon').textContent = stats.totals.rippon;
    document.getElementById('totalLabels').textContent = stats.totals.labels;
    document.getElementById('dashboardRippon').textContent = stats.totals.rippon;
    document.getElementById('dashboardLabels').textContent = stats.totals.labels;
    document.getElementById('dashboardShifts').textContent = stats.totals.recordsCount;

    // Inventory progress bars
    const ripponPercent = Math.max(0, (stats.inventory.ripponRemaining / stats.inventory.ripponCapacity) * 100);
    const labelPercent = Math.max(0, (stats.inventory.labelsRemaining / stats.inventory.labelsCapacity) * 100);

    const ripponProgress = document.getElementById('ripponProgress');
    ripponProgress.style.width = `${ripponPercent}%`;
    ripponProgress.textContent = `${Math.round(ripponPercent)}%`;
    document.getElementById('ripponStatus').textContent = `Approx ${stats.inventory.ripponRemaining} units remaining`;

    const labelProgress = document.getElementById('labelProgress');
    labelProgress.style.width = `${labelPercent}%`;
    labelProgress.textContent = `${Math.round(labelPercent)}%`;
    document.getElementById('labelStatus').textContent = `Approx ${stats.inventory.labelsRemaining} units remaining`;

    const reorderAlert = document.getElementById('reorderAlert');
    if (labelPercent < 10) {
      reorderAlert.style.display = 'block';
      reorderAlert.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i><strong>Reorder Alert:</strong> Labels need to be reordered soon.';
    } else if (ripponPercent < 20) {
      reorderAlert.style.display = 'block';
      reorderAlert.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i><strong>Reorder Alert:</strong> Rippon needs to be reordered soon.';
    } else {
      reorderAlert.style.display = 'none';
    }

    // Charts
    updateDailyConsumptionChart(dailyConsumptionChart, stats.byDate);
    updateLineConsumptionChart(lineConsumptionChart, stats.byLine);
    updateInventoryChart(inventoryChart, stats.inventory.ripponRemaining, stats.inventory.labelsRemaining, stats.totals.rippon, stats.totals.labels);
    updateReorderChart(reorderChart, stats);
  }

  async function updateHistoryTable() {
    const date = document.getElementById('filterDate').value;
    const line = document.getElementById('filterLine').value;
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (line) params.append('line', line);
    const records = await fetchJSON('/api/records' + (params.toString() ? `?${params.toString()}` : ''));
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = '';

    if (records.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No records found</td></tr>';
      return;
    }

    records.forEach(r => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${r.timestamp}</td>
        <td>${r.day}</td>
        <td>${r.line}</td>
        <td>${r.rippon}</td>
        <td>${r.labels}</td>
        <td>${r.shiftLeader}</td>
        <td>${r.notes || '-'}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  // --- Charts helpers (Chart.js) ---
  function createDailyConsumptionChart() {
    const ctx = document.getElementById('dailyConsumptionChart').getContext('2d');
    return new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'Rippon Consumption', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)', tension: 0.3, fill: true },
        { label: 'Label Consumption', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', tension: 0.3, fill: true }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Daily Consumption Trend' } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Units Consumed' } } }
      }
    });
  }

  function updateDailyConsumptionChart(chart, byDate) {
    const dates = Object.keys(byDate).sort();
    const ripponData = dates.map(d => byDate[d].rippon);
    const labelsData = dates.map(d => byDate[d].labels);
    chart.data.labels = dates;
    chart.data.datasets[0].data = ripponData;
    chart.data.datasets[1].data = labelsData;
    chart.update();
  }

  function createLineConsumptionChart() {
    const ctx = document.getElementById('lineConsumptionChart').getContext('2d');
    return new Chart(ctx, {
      type: 'bar',
      data: { labels: ['Line 1','Line 2','Line 3','Line 4','Line 6','Line 7'],
        datasets: [
          { label: 'Rippon Consumption', data: [0,0,0,0,0,0], backgroundColor: 'rgba(52, 152, 219, 0.7)' },
          { label: 'Label Consumption', data: [0,0,0,0,0,0], backgroundColor: 'rgba(231, 76, 60, 0.7)' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Consumption by Production Line' } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Units Consumed' } } }
      }
    });
  }

  function updateLineConsumptionChart(chart, byLine) {
    const labels = chart.data.labels;
    const ripponData = labels.map(l => (byLine[l] ? byLine[l].rippon : 0));
    const labelData  = labels.map(l => (byLine[l] ? byLine[l].labels : 0));
    chart.data.datasets[0].data = ripponData;
    chart.data.datasets[1].data = labelData;
    chart.update();
  }

  function createInventoryChart() {
    const ctx = document.getElementById('inventoryChart').getContext('2d');
    return new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Rippon Remaining', 'Labels Remaining', 'Rippon Used', 'Labels Used'],
        datasets: [{ data: [50,30,0,0],
          backgroundColor: ['rgba(52, 152, 219, 0.7)','rgba(231, 76, 60, 0.7)','rgba(52, 152, 219, 0.3)','rgba(231, 76, 60, 0.3)'],
          borderWidth: 1
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Inventory Status' }, legend: { position: 'bottom' } } }
    });
  }

  function updateInventoryChart(chart, ripponRemaining, labelsRemaining, totalRippon, totalLabels) {
    chart.data.datasets[0].data = [ripponRemaining, labelsRemaining, totalRippon, totalLabels];
    chart.update();
  }

  function createReorderChart() {
    const ctx = document.getElementById('reorderChart').getContext('2d');
    return new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'Rippon Inventory', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)', tension: 0.3, fill: true },
        { label: 'Label Inventory', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', tension: 0.3, fill: true }
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Inventory Projection' } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Units Remaining' } } } }
    });
  }

  function updateReorderChart(chart, stats) {
    const ripponRemaining = stats.inventory.ripponRemaining;
    const labelsRemaining = stats.inventory.labelsRemaining;
    const avgRippon = stats.averages.dailyRippon || 0.0001;
    const avgLabels = stats.averages.dailyLabels || 0.0001;

    const projectionDays = 7;
    const today = new Date();
    const labels = [];
    const ripponData = [];
    const labelsData = [];

    for (let i = 0; i <= projectionDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      labels.push(dateStr);
      ripponData.push(Math.max(0, ripponRemaining - (avgRippon * i)));
      labelsData.push(Math.max(0, labelsRemaining - (avgLabels * i)));
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = ripponData;
    chart.data.datasets[1].data = labelsData;
    chart.update();

    const ripponDays = Math.floor(ripponRemaining / avgRippon);
    const labelsDays = Math.floor(labelsRemaining / avgLabels);
    let reorderInfo = '';

    if (labelsDays < 7) {
      reorderInfo += '<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>Labels will run out in approximately ' + labelsDays + ' days. Reorder immediately.</div>';
    }
    if (ripponDays < 7) {
      reorderInfo += '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i>Rippon will run out in approximately ' + ripponDays + ' days. Consider reordering soon.</div>';
    }
    if (!reorderInfo) {
      reorderInfo = '<div class="alert alert-success"><i class="fas fa-check-circle me-2"></i>Both materials have sufficient inventory for at least 7 days.</div>';
    }
    document.getElementById('reorderInfo').innerHTML = reorderInfo;
  }
});

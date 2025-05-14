document.addEventListener('DOMContentLoaded', function () {
  const dateRangeSelect = document.getElementById('dateRangeSelect');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const applyDateRangeButton = document.querySelector('#customDateRange button');
  const regionButtons = document.querySelectorAll('.card:nth-child(2) button');
  const statusButtons = document.querySelectorAll('.card:nth-child(3) button');

  let selectedDateRange = 'All';
  let selectedRegion = '';
  let selectedStatus = '';

  function handleButtonClick(buttons, type) {
    buttons.forEach((button) => {
      button.addEventListener('click', function () {
        buttons.forEach((btn) => btn.classList.remove('active'));
        this.classList.add('active');

        if (type === 'region') {
          selectedRegion = this.textContent.trim();
        } else if (type === 'status') {
          selectedStatus = this.textContent.trim();
        }
        fetchData();
      });
    });
  }

  if (regionButtons.length > 0) handleButtonClick(regionButtons, 'region');
  if (statusButtons.length > 0) handleButtonClick(statusButtons, 'status');

  function fetchData() {
    fetch('http://192.168.1.209:5001/callcenterreportdata')
      .then((response) => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const openData = data.filter((item) => item['closeOpen'] === 'open');
        const filteredData = applyFilters(openData);

        if (filteredData.length === 0) {
          alert('No data available for the selected criteria.');
          clearAllChartsAndCounts();
          return;
        }

        updateOpenCount(filteredData);
        updateCharts(filteredData);
        updateTable(filteredData);  // Ensure DataTable updates without duplication
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        alert('Failed to fetch data. Please try again later.');
      });
  }

  function clearAllChartsAndCounts() {
    document.getElementById('open-count').innerHTML = '<h1>0</h1>';
    document.getElementById('total-counts').innerHTML = '';
    renderPieChart('container', []);
    renderColumnChartWithLine('container22', []);
    renderUserWiseCountChart('container43', [], []);
    const table = $('#complaintsTable').DataTable();
    table.clear().draw();  // Properly clear DataTable
  }

  // Apply filters based on selected date range, region, and status
  function applyFilters(data) {
    return data.filter((item) => {
      return filterByDateRange(item) && filterByRegion(item) && filterByStatus(item);
    });
  }


  // Filter by date range
  function filterByDateRange(item) {
    const cmpDate = new Date(item['cmpDate'].split('-').reverse().join('-'));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    switch (selectedDateRange) {
      case 'Yesterday':
        return cmpDate.toDateString() === yesterday.toDateString();
      case 'All':
        return true;
      case 'Last 7 Days':
        return cmpDate >= subtractDays(new Date(), 7);
      case 'Last 30 Days':
        return cmpDate >= subtractDays(new Date(), 30);
      case 'This Month':
        return isThisMonth(cmpDate);
      case 'This Year':
        return cmpDate.getFullYear() === new Date().getFullYear();
      case 'Custom':
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        return cmpDate >= startDate && cmpDate <= endDate;
      default:
        return true;
    }
  }

  function subtractDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  function isThisMonth(date) {
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  // Handle region "All" button to include Karachi and Lahore
  function filterByRegion(item) {
    if (selectedRegion === 'All') {
      return item['territory'] === 'Karachi' || item['territory'] === 'Lahore';
    }
    return selectedRegion === '' || item['territory'] === selectedRegion;
  }

  // Handle status "All" button to include all statuses
  function filterByStatus(item) {
    const status = item['currentStatusLevelType']?.trim().toLowerCase() || '';
    const selectedStatusLower = selectedStatus.trim().toLowerCase();

    if (selectedStatus === 'All') {
      return ['operation', 'logistic', 'factory', 'costing', 'adjustment', 'inspection'].some((s) =>
        status.includes(s)
      );
    }
    return selectedStatus === '' || status.includes(selectedStatusLower);
  }

  // Update open count
  function updateOpenCount(data) {
    document.getElementById('open-count').innerHTML = `<h1>${data.length}</h1>`;
  }

  // Update charts
  function updateCharts(data) {
    const statusCounts = getCounts(data, 'currentStatusLevelType');
    const sortedStatusData = toChartData(statusCounts).sort((a, b) => b.y - a.y);
    updateTotalCounts(statusCounts);
    renderPieChart('container', sortedStatusData);

    const zoneCounts = getCounts(data, 'zones', true);
    const sortedZoneData = toChartData(zoneCounts).sort((a, b) => b.y - a.y);
    renderColumnChartWithLine('container22', sortedZoneData);

    const currentStatusCounts = getCounts(data, 'currentStatus');
    const sortedCurrentStatusData = toChartData(currentStatusCounts).sort((a, b) => b.y - a.y);
    renderUserWiseCountChart('container43', sortedCurrentStatusData, data);
  }


  // Get counts from data
  function getCounts(data, key, splitMultiple = false) {
    const counts = {};
    data.forEach((item) => {
      let keys = [item[key]];
      if (splitMultiple && keys[0]) keys = keys[0].split(',').map((k) => k.trim());
      keys.forEach((k) => {
        if (k) counts[k] = (counts[k] || 0) + 1;
      });
    });
    return counts;
  }

  function toChartData(counts) {
    return Object.keys(counts).map((key) => ({ name: key, y: counts[key] }));
  }

  // Define a color mapping for status types
  const statusColors = {
    Operation: '#000000',
    Logistic: '#000000',
    Factory: '#000000',
    Costing: '#000000',
    Adjustment: '#000000',
    Other: '#000000' // Default color for any other status
  };

  // Update total counts section with corresponding colors
  function updateTotalCounts(statusCounts) {
    const totalCountsElement = document.getElementById('total-counts');
    if (Object.keys(statusCounts).length === 0) {
      totalCountsElement.innerHTML = '';  // Clear the section if no data
      return;
    }

    let totalCountsHtml = '<h2>Total Counts of Current Status Level Type</h2><ul>';
    Object.keys(statusCounts).forEach((status) => {
      const color = statusColors[status] || statusColors.Other;
      totalCountsHtml += `<li style="color: ${color};"><b>${status}:</b> ${statusCounts[status]}</li>`;
    });
    totalCountsHtml += '</ul>';
    totalCountsElement.innerHTML = totalCountsHtml;
  }

  // Render pie chart with matching colors for status types
  function renderPieChart(container, data) {
    console.log('Rendering pie chart with data:', data);

    // Apply corresponding colors to pie chart data
    const coloredData = data.map(item => {
      const color = statusColors[item.name] || statusColors.Other;
      return { ...item, color: color };
    });

    Highcharts.chart(container, {
      chart: {
        type: 'pie',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',  // Transparent with slight white overlay
        borderRadius: 10,  // Rounded corners for a polished look
        shadow: true,  // Add shadow effect
      },
      title: {
        text: 'Customer Complaints Distribution',
        style: {
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#333333',
          fontFamily: 'Arial, sans-serif'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',  // Dark tooltip background
        style: { color: '#FFFFFF', fontSize: '14px' }, // White text for contrast
        pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
      },
      plotOptions: {
        pie: {
          innerSize: '60%',  // Increase inner circle size for a modern donut effect
          depth: 45,  // Add 3D depth
          dataLabels: {
            enabled: true,
            style: {
              color: '#333333',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: 'Arial, sans-serif',
              textOutline: 'none'  // Remove the default text outline
            },
            format: '<b>{point.name}</b>: {point.percentage:.1f} %'
          },
          borderColor: '#FFFFFF',  // White border for each slice
          borderWidth: 2,
          showInLegend: true,  // Add a legend for better presentation
          states: {
            hover: { brightness: 0.1 },  // Brighten the slice on hover
          },
        }
      },
      series: [{
        name: 'Complaints',
        data: coloredData,  // Assumes `coloredData` contains name and value pairs
        colors: [
          '#1abc9c', '#3498db', '#9b59b6', '#e74c3c',
          '#f1c40f', '#2ecc71', '#34495e', '#e67e22'
        ],  // Vibrant color palette
      }],
      legend: {
        layout: 'horizontal',
        align: 'center',
        verticalAlign: 'bottom',
        itemStyle: {
          fontSize: '14px',
          color: '#333333',
          fontWeight: '600',
          fontFamily: 'Arial, sans-serif'
        }
      },
      credits: { enabled: false }
    });

  }


  // Render column chart with line
  function renderColumnChartWithLine(container, data) {
    console.log('Rendering column chart with data:', data);

    Highcharts.chart(container, {
      chart: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',  // Transparent with slight white tint
        borderRadius: 10,
        shadow: true,
      },
      title: {
        text: 'Count Overview',
        style: {
          fontSize: '20px',
          fontWeight: 'bold',
          fontFamily: 'Arial, sans-serif',
          color: '#333333'
        }
      },
      xAxis: {
        categories: data.map(d => d.name),
        labels: {
          style: {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif'
          }
        }
      },
      yAxis: [{
        title: {
          text: 'Count',
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif'
          }
        },
        gridLineDashStyle: 'Dash',
        gridLineColor: '#e0e0e0'
      }],
      tooltip: {
        shared: true,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        style: { color: '#ffffff' },
        pointFormat: '<span style="color:{point.color}">\u25CF</span> {series.name}: <b>{point.y}</b><br/>'
      },
      plotOptions: {
        column: {
          dataLabels: {
            enabled: true,
            format: '{point.y}',
            style: {
              color: '#333333',
              fontWeight: '600'
            }
          },
          borderRadius: 5,
          borderColor: '#FFFFFF',
          borderWidth: 1,
          pointPadding: 0.2,
          groupPadding: 0.1
        },
        line: {
          dataLabels: {
            enabled: true,
            format: '{point.y}',
            style: {
              color: '#333333',
              fontWeight: '600'
            }
          },
          marker: {
            enabled: true,  // Enable markers for better visibility
            radius: 5,
            symbol: 'circle',
            fillColor: '#3498db'
          },
          lineWidth: 2,
          states: {
            hover: {
              lineWidth: 3  // Thicker line on hover
            }
          }
        }
      },
      series: [
        {
          name: 'Count',
          data: data,
          type: 'column',
          color: 'rgba(46, 204, 113, 0.7)',  // Transparent green color
        },
        {
          name: 'Line',
          data: data.map(d => d.y),
          type: 'line',
          color: '#e74c3c',  // Red color for contrast
          dashStyle: 'ShortDash',
          marker: { enabled: true }
        }
      ],
      legend: {
        layout: 'horizontal',
        align: 'center',
        verticalAlign: 'bottom',
        itemStyle: {
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          color: '#333333'
        }
      },
      credits: { enabled: false }
    });
  }


  function renderUserWiseCountChart(container, data, fullData) {
    // Group complaints by user and find the one with the highest pendingSinceDays
    const maxPendingDaysByUser = {};

    fullData.forEach(item => {
      const user = item['currentStatus'];
      const pendingDays = parseInt(item['pendingSinceDays'], 10);

      // If this is the first complaint for the user or has more pending days, update it
      if (!maxPendingDaysByUser[user] || pendingDays > maxPendingDaysByUser[user].pendingDays) {
        maxPendingDaysByUser[user] = { ...item, pendingDays };
      }
    });

    // Prepare the data for the pending days bar (only the complaint with the highest pending days per user)
    const pendingDaysData = data.map(d => {
      const user = d.name;
      const maxPendingDays = maxPendingDaysByUser[user] ? maxPendingDaysByUser[user].pendingDays : 0;
      return {
        name: user,
        y: maxPendingDays // Use the highest pending days for each user
      };
    });

    // Render the chart with both series (Total Complaints and Max Pending Days)
    Highcharts.chart(container, {
      chart: {
        type: 'column',
        backgroundColor: '', // Gradient background
        shadow: true,  // Add shadow effect
        borderRadius: 10,  // Rounded corners
      },
      title: {
        text: 'Complaints Overview',
        style: {
          color: '#333333',
          fontWeight: 'bold',
          fontSize: '20px',
          fontFamily: 'Arial, sans-serif'
        }
      },
      xAxis: {
        categories: data.map(d => d.name),
        labels: {
          style: {
            color: '#4D4D4D',
            fontSize: '14px',
            fontWeight: '600'
          }
        },
        lineColor: '#7a7a7a'
      },
      yAxis: [{
        title: {
          text: 'Count',
          style: {
            color: '#4D4D4D',
            fontWeight: '600',
            fontSize: '16px'
          }
        },
        gridLineColor: '#d6d6d6'
      }],
      plotOptions: {
        column: {
          dataLabels: {
            enabled: true,
            format: '{point.y}',
            style: {
              fontWeight: 'bold',
              fontSize: '13px',
              color: '#333'
            }
          },
          borderRadius: 5,  // Round bar edges
          shadow: true  // Add shadow to columns
        },
      },
      tooltip: {
        shared: true,
        backgroundColor: '#f0f0f0',
        borderColor: '#ccc',
        style: {
          color: '#333',
          fontSize: '14px'
        },
        formatter: function () {
          return `<b>${this.x}</b><br>
                      ${this.points.map(point =>
            `<span style="color:${point.color}">\u25CF</span> 
                          ${point.series.name}: <b>${point.y}</b><br>`).join('')}`;
        }
      },
      series: [
        {
          name: 'Total Complaints',
          data: data,
          type: 'column',
          color: {
            linearGradient: { x1: 0, x2: 0, y1: 0, y2: 1 },
            stops: [
              [0, '#1a75ff'],
              [1, '#80bfff']
            ]
          }
        },
        {
          name: 'Max Pending Since Days',
          data: pendingDaysData,
          type: 'column',
          color: '#FF5733'
        }
      ],
      credits: { enabled: false }
    });

  }

  // Update the DataTable
  function updateTable(newData) {
    const table = $('#complaintsTable').DataTable();

    // Clear previous data to prevent duplication
    table.clear();

    // Add new data and redraw the table
    table.rows.add(newData).draw();
  }



  // Event listeners
  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', function () {
      selectedDateRange = this.value;
      document.getElementById('customDateRange').style.display =
        selectedDateRange === 'Custom' ? 'block' : 'none';
      if (selectedDateRange !== 'Custom') {
        fetchData();
      }
    });
  }

  if (applyDateRangeButton) {
    applyDateRangeButton.addEventListener('click', function () {
      if (startDateInput.value && endDateInput.value) {
        fetchData();
      } else {
        alert('Please select both start and end dates.');
      }
    });
  }

  if (startDateInput) {
    startDateInput.addEventListener('change', function () {
      endDateInput.min = this.value;
    });
  }

  if (endDateInput) {
    endDateInput.addEventListener('change', function () {
      if (new Date(endDateInput.value) <= new Date(startDateInput.value)) {
        alert('End date must be after the start date.');
        endDateInput.value = '';
      }
    });
  }

  // Adjust DataTable search functionality to search specific columns independently
  $(document).ready(function () {
    const table = $('#complaintsTable').DataTable({
      ajax: { url: 'http://192.168.1.209:5001/callcenterreportdata', dataSrc: '' },
      columns: [
        { data: 'currentStatus' },
        { data: 'cmpNo' },
        { data: 'fromUser' },
        { data: 'pendingSinceDays' },
        { data: 'issueinMattress' },
        { data: 'complaintLatestRemarks' }
      ],
      paging: true,
      searching: true,
      ordering: true,
      responsive: true,
      initComplete: function () {

        this.api().columns().every(function () {
          const column = this;
          $('input', column.footer()).on('keyup change clear', function () {
            if (column.search() !== this.value) {
              column.search(this.value).draw();
            }
          });
        });
      }
    });


    $('#complaintsTable thead th').on('click', function () {
      table.order([$(this).index(), 'asc']).draw();
    });
  });

  fetchData();
});

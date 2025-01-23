let dataSegments = [];
let selectedRange = {};
let labelColors = {};
let currentData = [];

document.addEventListener('DOMContentLoaded', () => {
    fetch('subsystems.csv')
        .then(response => response.text())
        .then(data => {
            const subsystems = parseSubsystemsCSV(data);
            populateSubsystemDropdown(subsystems);
        });
});

//Function for Parsing the Subsystems
function parseSubsystemsCSV(data) {
    const lines = data.split('\n');
    const result = [];

    lines.forEach((line, index) => {
        if (index === 0) return;
        const [subsystem, tagName] = line.split(',');
        if (subsystem && tagName) {
            result.push({ subsystem: subsystem.trim(), tagName: tagName.trim() });
        }
    });

    return result;
}

//Function for the subsystem dropdown
function populateSubsystemDropdown(subsystems) {
    const subsystemSelect = document.getElementById('subsystemSelect');
    const uniqueSubsystems = [...new Set(subsystems.map(item => item.subsystem))];
    
    uniqueSubsystems.forEach(subsystem => {
        const option = document.createElement('option');
        option.value = subsystem;
        option.textContent = subsystem;
        subsystemSelect.appendChild(option);
    });
}

//Function for fetching the tags from corresponding subsystem
function loadSubsystemTags() {
    const selectedSubsystem = document.getElementById('subsystemSelect').value;
    if (!selectedSubsystem) return;

    fetch('subsystems.csv')
        .then(response => response.text())
        .then(data => {
            const subsystems = parseSubsystemsCSV(data);
            const filteredTags = subsystems
                .filter(item => item.subsystem === selectedSubsystem)
                .map(item => item.tagName);
            
            populateTagsDropdown(filteredTags);
        });
}

//Function for tag dropdown
function populateTagsDropdown(tags) {
    const sensorTagSelect = document.getElementById('sensorTag');
    sensorTagSelect.innerHTML = '<option value="">Select Tag</option>';
    tags.forEach(tagName => {
        const option = document.createElement('option');
        option.value = tagName;
        option.textContent = tagName;
        sensorTagSelect.appendChild(option);
    });
}

//Function for opening a local file 
function openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = event => {
                const content = event.target.result;
                const data = parseAndSortCSV(content);
                //Removed .csv from file name
                const fileNameWithoutExtension = file.name.replace(/\.csv$/i,'');
                calculateAndDisplayStats(data, fileNameWithoutExtension);
                plotGraph(data);
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

//Function for parsing data from loading csv file
function parseAndSortCSV(data) {
    const lines = data.split('\n');
    const result = [];

    lines.forEach((line, index) => {
        if (index === 0) return;
        const [timeStamp, value] = line.split(',');
        if (timeStamp && value) {
            result.push({ timeStamp: new Date(timeStamp.trim()), value: parseFloat(value.trim()) });
        }
    });

    result.sort((a, b) => a.timeStamp - b.timeStamp);
    return result;
}

//Function for calculating the stats of a tag
function calculateAndDisplayStats(data, tagName) {
    const values = data.map(item => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const stdDev = calculateStdDev(values);

    const tableBody = document.querySelector('#statsTable tbody');
    tableBody.innerHTML = '';

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${tagName}</td>
        <td>${min.toFixed(2)}</td>
        <td>${max.toFixed(2)}</td>
        <td>${stdDev.toFixed(2)}</td>
    `;
    tableBody.appendChild(row);
}

//Function for calculating the standard deviation
function calculateStdDev(values) {
    const mean = values.reduce((a, b) => a + b) / values.length;
    return Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
}

//Function for loading the data of a selected tag
function loadData() {
    const selectedTag = document.getElementById('sensorTag').value;
    if (!selectedTag) return;

    fetch(`${selectedTag}.csv`)
        .then(response => response.text())
        .then(data => {
            const parsedData = parseAndSortCSV(data);
            calculateAndDisplayStats(parsedData, selectedTag);
            plotGraph(parsedData);
        });
}

//Function for plotting the time series graph
function plotGraph(data) {
    currentData = data;
    const trace = {
        x: data.map(item => item.timeStamp),
        y: data.map(item => item.value),
        type: 'scatter',
        mode: 'lines',
        line: { color: 'blue' },
        name: 'Default'
    };

    const layout = {
        title: 'Time Series Data',
        xaxis: { title: 'Timestamp' },
        yaxis: { title: 'Value' },
        height: 600,
        dragmode: 'pan'
    };

    Plotly.newPlot('graph', [trace], layout);

    document.getElementById('graph').on('plotly_selected', event => handleSelection(event));
}

//Function for enabling drag for the graph when labelling
function enableLabelSelection() {
    Plotly.relayout('graph', { dragmode: 'select' });
}

//Function for handling the drag information for labelling
function handleSelection(event) {
    if (event && event.range) {
        selectedRange = {
            start: new Date(event.range.x[0]),
            end: new Date(event.range.x[1])
        };
        
        //Open the Label Popup
        openLabelPopup();
    }
}
//Open the Label Popup
function openLabelPopup() {
    const modal = document.getElementById('labelPopupModal');
    modal.style.display = 'flex';
}
//Close the Label Popup
function closeLabelPopup() {
    document.getElementById('labelPopupModal').style.display = 'none';
}
//Open the Delete Label Modal
function openDeleteLabelModal(){
    const modal = document.getElementById('deleteLabelModal');
    const labelTableBody = document.querySelector('#labelTable tbody');
    labelTableBody.innerHTML = '';

    dataSegments.forEach((segment, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${segment.label}</td>
            <td>${segment.start.toLocaleString()}</td>
            <td>${segment.end.toLocaleString()}</td>
            <td><button onclick="deleteLabel(${index})">Delete</button></td>
            `;
            labelTableBody.appendChild(row);
    });
    modal.style.display = 'flex';
}
//Close the Delete Label Modal
function closeDeleteLabelModal(){
    document.getElementById('deleteLabelModal').style.display = 'none';
}

//Delete a label and update graph
function deleteLabel(index){
    dataSegments.splice(index, 1);
    updatePlot();
    openDeleteLabelModal();
}
//Function to apply label to the graph
function applyLabel() {
    //Set default label to N
    const label = document.getElementById('labelInput').value || 'N';

    if (!labelColors[label]) {
        labelColors[label] = `hsl(${Object.keys(labelColors).length * 60 % 360}, 70%, 50%)`;
    }

    dataSegments.push({
        start: selectedRange.start,
        end: selectedRange.end,
        label: label,
        color: labelColors[label]
    });

    document.getElementById('labelInput').value = '';
    updatePlot();
    closeLabelPopup();
}

function removeLabel(index){
    dataSegments.splice(index,1);
    updatePlot();
    updateLabelsList();
}


//Function for updating labelled time series graph
function updatePlot() {
    //Base trace with default color
    const baseTrace = {
        x: currentData.map(item => item.timeStamp),
        y: currentData.map(item => item.value),
        type: 'scatter',
        mode: 'lines',
        line: { color: 'blue' },
        name: 'Default'
    };

    //Filter the mapped time stamp 
    const segmentTraces = dataSegments.map(segment => {
        const segmentData = currentData.filter(item =>
            item.timeStamp >= segment.start && item.timeStamp <= segment.end
        );

        //Return filtered mapped data of timestamp and value
        return {
            x: segmentData.map(item => item.timeStamp),
            y: segmentData.map(item => item.value),
            type: 'scatter',
            mode: 'lines',
            line: { color: segment.color, width: 4 },
            name: segment.label
        };
    });

    Plotly.react('graph', [baseTrace, ...segmentTraces], {
        title: 'Time Series Data',
        xaxis: { title: 'Timestamp' },
        yaxis: { title: 'Value' },
        height: 600
    });
}

//Function for storing the labels and saving it to a csv file
function saveLabels() {

    const tagName = document.getElementById('sensorTag').value || 'data';
    const fileName = `${tagName}_labelled.csv`;

    //csv header
    let csvContent = "data:text/csv;charset=utf-8,Timestamp,ValueNumeric,Label\n";
    
    //Loop through each data point
    currentData.forEach(dataPoint => {
        let label = "Normal"; //Default label

        //Check if data points falls within any labeled segments
        dataSegments.forEach(segment => {
            if(dataPoint.timeStamp >= segment.start && dataPoint.timeStamp <= segment.end){
                label = segment.label; //If in range, assign label
            }
        });
        csvContent += `${dataPoint.timeStamp.toISOString()},${dataPoint.value},${label}\n`;
    });


    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
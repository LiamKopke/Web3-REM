getStations();
async function getStations(){
    let stations = await (await fetch('http://10.101.0.12:8080/stations')).json();
    for(let i = 0; i < stations.length; i++){
        // Start Station
        let startStation = document.createElement('option');
        startStation.value = stations[i].StationId;        
        startStation.innerHTML = stations[i].Name;
        document.querySelector('#startStation').add(startStation);
        // End Station
        let endStation = document.createElement('option');
        endStation.value = stations[i].StationId;
        endStation.innerHTML = stations[i].Name;
        document.getElementById('endStation').add(endStation);    
    }
}
async function findTravelTime(startStation, endStation, speed){
    let distance = await (await fetch('http://10.101.0.12:8080/distance/' + encodeURIComponent(startStation.Name) + '/' + encodeURIComponent(endStation.Name))).json();
    return (distance / speed) * secondsPerHour;
}
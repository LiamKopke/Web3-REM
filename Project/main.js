let latitude = 0;
let longitude = 0;
let secondsPerHour = 3600;
let millisecondsPerSecond = 1000;
let divider = 50;
// Used to find the correct time using UTC and not local time
let timeZoneOffset = 5;
let x = '98 avenue Kirkwood, Beaconsfield, QC, Canada';
// Gets the stations and puts them in the dropdown
getLocation();
getStations();
// On form submit, gets the two stations and does the things
document.querySelector('#form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Gets the start station name and id
    let startStation = document.querySelector('#startStation').options[document.querySelector('#startStation').selectedIndex];
    let startStationName = startStation.text;
    let startStationId = startStation.value;

    // Gets the end station name and id
    let endStation = document.querySelector('#endStation').options[document.querySelector('#endStation').selectedIndex];
    let endStationName = endStation.text;
    let endStationId = endStation.value;

    // Uses the names to get the path
    let path = await (await fetch('http://10.101.0.12:8080/path/' + startStationName + '/' + endStationName)).json();
    
    // Gets the date and time the user is leaving or arriving at
    let dateTime = new Date(document.querySelector('#time').value);
    console.log(dateTime);
    
    // Gets the speed of the train
    let speed = await (await fetch('http://10.101.0.12:8080/averageTrainSpeed/')).json();
    speed = speed[0].AverageSpeed;

    // The path
    for(let i = 0; i < path.length - 1; i++) {

        // Gets the name and id of the station is it at
        let name = path[i].Name;
        let id = path[i].SegmentId;
        let stationId = path[i].StationId;

        // Gets the schedule for the station
        let iSchedule = await (await fetch('http://10.101.0.12:8080/schedule/' + name)).json();

        // Gets the next departure time from that station
        let departure = findNextTime(iSchedule, id, dateTime);
        console.log('Leaving from ' + name + ' at ' + departure);
        
        // Finds how long the train will take to get to the next station
        secondsToAdd = await findTravelTime(path[i], path[i + 1], speed);            
        console.log('Arriving at ' + path[i + 1].Name + ' in ' + secondsToAdd + ' seconds');

        // Adds the time to the dateTime   
        departure = new Date(departure);

        //Seconds
        totalSeconds = secondsToAdd;
        secondsToSet = secondsToAdd % 60;         
        secondsToAdd = departure.getSeconds() + secondsToSet;

        //Minutes
        totalMinutes = departure.getMinutes() + Math.floor((secondsToAdd+totalSeconds) / 60);
        minutesToSet = totalMinutes % 60;
        
        //Hours
        // The +5 is to offset the timezone
        totalHours = departure.getHours() + timeZoneOffset + Math.floor(totalMinutes / 60);
        hoursToSet = totalHours % 24;
                   
        dateTime.setSeconds(secondsToSet);
        dateTime.setMinutes(minutesToSet);
        dateTime.setHours(hoursToSet);

        
        // Display the information about that station
        displayStationInfo(stationId);

        // Display the notification at that station
        displayNotification(stationId); 

        // Wait at each station
        await timeBetweenStations(totalSeconds);
    };   
    // Display the information about the last station
    displayStationInfo(path[path.length - 1].StationId);

    // Display the notification at the last station
    displayNotification(path[path.length - 1].StationId);    
});
// Adds the stations names to the dropdown in the form
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
// Gets the next train time from the station
function findNextTime(schedule, id, arrival){
    for (let i = 0 ; i < schedule.length; i++){

        // Converts both times to HH:MM:SS (12h)
        // get the time in HH:MM:SS for schedule[i].Time
        let scheduleTime = schedule[i].Time.split('T')[1].split(':');
        let scheduleTimeHours = parseInt(scheduleTime[0]);
        let scheduleTimeMinutes = parseInt(scheduleTime[1]);
        let scheduleTimeSeconds = parseInt(scheduleTime[2]);
        
        // get the time in HH:MM:SS for arrival
        let arrivalTime = arrival.toLocaleTimeString().split(':');
        let arrivalTimeHours = parseInt(arrivalTime[0]);
        let arrivalTimeMinutes = parseInt(arrivalTime[1]);
        let arrivalTimeSeconds = parseInt(arrivalTime[2]);

        // If the schedule time is after the arrival time, it's the next time
        if(schedule[i].SegmentId == id){
            if(scheduleTimeHours > arrivalTimeHours){
                return schedule[i].Time;
            }
            else if(scheduleTimeHours == arrivalTimeHours){
                if(scheduleTimeMinutes > arrivalTimeMinutes){
                    return schedule[i].Time;
                }
                else if(scheduleTimeMinutes == arrivalTimeMinutes){
                    if(scheduleTimeSeconds > arrivalTimeSeconds){
                        return schedule[i].Time;
                    }
                }
            }
        }
    }
}
// Gets the time it takes to get to the next station
async function findTravelTime(startStation, endStation, speed){
    let distance = await (await fetch('http://10.101.0.12:8080/distance/' + encodeURIComponent(startStation.Name) + '/' + encodeURIComponent(endStation.Name))).json();
    return (distance / speed) * secondsPerHour;
}
// Simulates the wait at each station
async function timeBetweenStations(seconds){
    return new Promise(resolve => {
        setTimeout(() => {resolve()}, (seconds / divider) * millisecondsPerSecond);
    });
}
// Displays the information about the station
async function displayStationInfo(id){
    let info = await (await fetch('http://10.101.0.12:8080/stations/' + id)).json();
    let station = document.querySelector('#StationInfo');

    // Station Name
    let name = document.createElement('div');
    name.innerHTML = '<h2>Station Information</h2>';
    let t = "<span style='color: green'>True</span>";
    let f = "<span style='color: red'>False</span>";
    name.innerHTML += info[0].Name;
    name.innerHTML += '<br/> Address : ' + info[0].Number + ' ' +  info[0].StreetName + ', ' + info[0].City + ' ' + info[0].Province + ' ' + info[0].Country;
    name.innerHTML += info[0].AccessibilityFeature == true ? "<br/>Accessibility Features: " + t : "<br/>Accessibility Features: " + f;
    name.innerHTML += info[0].BicycleAvailability == true ? "<br/>Bicycle Availability: " + t : "<br/>Bicycle Availability: " + f;
    name.innerHTML += info[0].Elevator == true ? "<br/>Elevator Availability: " + t : "<br/>Elevator Availability: " + f;
    station.innerHTML = name.innerHTML;
}
// Displays the notification at the station
async function displayNotification(id){
    console.log(await (await fetch('http://10.101.0.12:8080/notifications/' + id)).json())
}
// for the api, gets the coordinates from the address
async function getLocation() {
    let response = await fetch('http://api.positionstack.com/v1/forward?access_key=30de06d4d486065ed537303ed185cc7e&query=' + encodeURIComponent(x));
    let data = await response.json();
    latitude = data.data[0].latitude;
    longitude = data.data[0].longitude;
    console.log('Latitude is ' + latitude + '° Longitude is ' + longitude + '°');
}
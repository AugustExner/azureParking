class ParkingSpot {
  constructor(spotID, latitude, longitude, occupied) {
    this.spotID = spotID;
    this.latitude = latitude;
    this.longitude = longitude;
    this.occupied = occupied;
  }

  // Method to update the occupancy status
  static toggleOccupancy(currentStatus) {
    return !currentStatus;
  }
}

class RegisteredCar {
  constructor(oldLat, oldLng, newLat, newLng) {
    this.oldLat = oldLat;
    this.oldLng = oldLng;
    this.newLat = newLat;
    this.newLng = newLng;
  }
}

class Street {
  constructor(name) {
    this.name = name;
    this.parkingSpots = []; 
  }

  addParkingSpot(parkingSpot) {
    this.parkingSpots.push(parkingSpot);
  }
}

module.exports = { ParkingSpot, Street };

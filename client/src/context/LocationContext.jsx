import React, { createContext, useContext, useState } from "react";

export const CITIES_LIST = [
    "Nagpur",
    "Delhi",
    "Bengaluru",
    "Hyderabad",
    "Mumbai",
    "Pune",
    "Kolkata",
    "Chennai",
    "Jaipur",
    "Goa",
    "Varanasi",
    "Kochi",
    "Shimla",
    "Srinagar",
    "Udaipur",
    "Jodhpur",
    "Leh",
    "Ahmedabad",
    "Chandigarh",
];

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
    const [currentCity, setCurrentCity] = useState("Nagpur");

    return (
        <LocationContext.Provider value={{ currentCity, setCurrentCity }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocationContext = () => useContext(LocationContext);

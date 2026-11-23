"use client";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import {
  useGetCountriesQuery,
  useGetStatesQuery,
} from "@/redux/services/eventsApi";
import Navbar from "@/components/layouts/Navbar";

interface HeroProps {
  isCategoryOpen: boolean;
  isLocationOpen: boolean;
  toggleCategoryDropdown: () => void;
  toggleLocationDropdown: () => void;
  handleCategoryChange: (category: string) => void;
  handleLocationChange: (location: string) => void;
  onSearch: (
    category: string,
    locationId: string,
    countryName: string,
    stateName: string,
    search?: string
  ) => void;
  className?: string;
  backgroundImage?: string;
  height?: string;
  heading?: string;
  subheading?: string;
  showSearch?: boolean;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

interface State {
  id: string;
  name: string;
  code: string;
  countryId: string;
}

export default function HeroWithNavbar({
  isCategoryOpen,
  isLocationOpen,
  toggleCategoryDropdown,
  toggleLocationDropdown,
  handleCategoryChange,
  onSearch,
  className,
  backgroundImage = "url('/heroImage.png')",
  height = "600px",
  heading = "Simplify Your Event Planning with<br />All-in-One Booking.",
  subheading = "Book stunning venues and top-notch catering services effortlessly.",
  showSearch = true,
}: HeroProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedState, setSelectedState] = useState("");
  const [selectedStateId, setSelectedStateId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState("");

  // Fetch countries and states
  const { data: countriesData } = useGetCountriesQuery({ limit: 250 });
  const { data: statesData, isFetching: isFetchingStates } = useGetStatesQuery(
    { limit: 500, countryId: selectedCountry || undefined },
    { skip: !selectedCountry }
  );

  // Filter states client-side by selected country
  const filteredStates = selectedCountry
    ? (statesData?.docs ?? []).filter(
        (state: State) => state.countryId === selectedCountry
      )
    : [];

  // Reset state selection when country changes
  useEffect(() => {
    if (selectedCountry) {
      setSelectedState("");
      setSelectedStateId("");
    }
  }, [selectedCountry]);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    handleCategoryChange(category);
  };

  const handleCountrySelect = (countryId: string) => {
    setSelectedCountry(countryId);
    setSelectedState("");
    setSelectedStateId("");
    setSearchError("");
  };

  const handleStateSelect = (stateId: string) => {
    const selectedStateData = filteredStates.find(
      (state: State) => state.id === stateId
    );
    setSelectedState(selectedStateData?.name || "");
    setSelectedStateId(stateId);
    setSearchError("");
  };

  const handleApplySearch = () => {
    if (selectedCountry && !selectedStateId) {
      setSearchError("Select a state to search within this country.");
      return;
    }
      const selectedCountryData = countriesData?.docs.find(
        (country: Country) => country.id === selectedCountry
      );
      const selectedStateData = filteredStates.find(
        (state: State) => state.id === selectedStateId
      );

      onSearch(
        selectedCategory,
        selectedStateId,
        selectedCountryData?.name || "",
        selectedStateData?.name || "",
        searchText.trim()
      );
  };

  return (
    <section
      className={`relative bg-cover bg-center bg-no-repeat ${className}`}
      style={{
        backgroundImage,
        minHeight: height,
      }}
    >
      {/* Content container */}
      <div className="relative max-w-6xl mx-auto px-4">
        <Navbar variant="hero" />

        {/* Hero Content */}
        <div
          className="flex flex-col items-center justify-center text-center text-white"
          style={{ minHeight: `calc(${height} - 5rem)` }}
        >
          <h1
            className="md:text-5xl text-3xl font-bold mb-2"
            dangerouslySetInnerHTML={{ __html: heading }}
          />
          {subheading && (
            <p className="text-sm mb-12 max-w-2xl">{subheading}</p>
          )}

          {/* Conditionally render search UI */}
          {showSearch && (
            <form
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 w-full max-w-5xl bg-white p-3 rounded-lg items-center shadow-sm border"
              onSubmit={(event) => { event.preventDefault(); handleApplySearch(); }}
            >
              {/* Category Dropdown */}
              <div className="relative w-full md:flex-1">
                <div className="relative flex items-center">
                  <select
                    aria-label="Service category"
                    className="appearance-none w-full px-3 py-2 rounded-md bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 text-gray-700 text-sm cursor-pointer"
                    value={selectedCategory}
                    onChange={(e) => handleCategorySelect(e.target.value)}
                    onClick={toggleCategoryDropdown}
                  >
                    <option value="all">All Category</option>
                    <option value="EVENTCENTERS">Event Centers</option>
                    <option value="CATERING">Catering Services</option>
                  </select>
                  <ChevronDown
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 transition-transform duration-200 cursor-pointer ${
                      isCategoryOpen ? "rotate-180" : "rotate-0"
                    }`}
                    size={16}
                  />
                </div>
              </div>

              {/* Country Dropdown */}
              <div className="relative w-full md:flex-1">
                <div className="relative flex items-center">
                  <select
                    aria-label="Country"
                    className="appearance-none w-full px-3 py-2 rounded-md bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 text-gray-700 text-sm cursor-pointer"
                    value={selectedCountry}
                    onChange={(e) => handleCountrySelect(e.target.value)}
                  >
                    <option value="">Select Country</option>
                    {countriesData?.docs.map((country: Country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 cursor-pointer"
                    size={16}
                  />
                </div>
              </div>

              {/* State Dropdown */}
              <div className="relative w-full md:flex-1">
                <div className="relative flex items-center">
                  <select
                    aria-label="State"
                    className="appearance-none w-full px-3 py-2 rounded-md bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 text-gray-700 text-sm cursor-pointer disabled:opacity-50"
                    value={selectedStateId}
                    onChange={(e) => handleStateSelect(e.target.value)}
                    disabled={!selectedCountry || isFetchingStates}
                    onClick={toggleLocationDropdown}
                  >
                    <option value="">Select State</option>
                    {filteredStates.map((state: State) => (
                      <option key={state.id} value={state.id}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 transition-transform duration-200 cursor-pointer ${
                      isLocationOpen ? "rotate-180" : "rotate-0"
                    }`}
                    size={16}
                  />
                </div>
              </div>

              <input
                type="search"
                aria-label="Search venues and catering"
                placeholder="Name or keyword"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="w-full px-3 py-2 rounded-md bg-gray-50 border border-gray-300 text-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
              />

              {/* Apply Search Button */}
              <button
                type="submit"
                className="bg-[#0047AB] hover:bg-blue-700 text-white px-4 py-2 rounded-md w-full md:w-auto md:min-w-[140px] text-sm font-medium transition-colors cursor-pointer"
                disabled={isFetchingStates}
              >
                Apply Search
              </button>
              {searchError && <p role="alert" className="md:col-span-2 lg:col-span-5 text-red-700 text-sm text-left">{searchError}</p>}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

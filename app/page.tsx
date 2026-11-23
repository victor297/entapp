"use client";
import { useState } from "react";
import HeroWithNavbar from "@/components/layouts/HeroWithNavbar";
import Features from "@/components/layouts/Features";
import FeaturedVenues from "@/components/layouts/FeaturedVenues";
import CateringServices from "@/components/layouts/CateringServices";
import ElevateEvents from "@/components/layouts/ElevateEvents";
import EventPlanning from "@/components/layouts/EventPlanning";
import BookEvent from "@/components/layouts/BookEvent";
import Testimonials from "@/components/layouts/Testimonials";
import EventGallery from "@/components/layouts/EventGallery";
import PlanNextEvent from "@/components/layouts/PlanNextEvent";
import Footer from "@/components/layouts/Footer";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [isLocationOpen, setIsLocationOpen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const router = useRouter();
  const handleSearch = (
    category: string,
    locationId: string,
    countryName: string,
    stateName: string,
    search = ""
  ) => {
    const params = new URLSearchParams({ category });
    if (locationId) params.set("location", locationId);
    if (countryName) params.set("country", countryName);
    if (stateName) params.set("state", stateName);
    if (search) params.set("search", search);
    router.push(`/search?${params.toString()}`);
  };
  const handleCategoryChange = (category: string) => {
    console.log("Category changed to:", category);
  };

  const handleLocationChange = (location: string) => {
    console.log("Location changed to:", location);
  };

  const testimonials: {quote:string;name:string;position:string;company:string}[] = [];

  const testimonialsPerPage = 3;
  const totalPages = Math.ceil(testimonials.length / testimonialsPerPage);

  const handleNextTestimonial = () =>
    setCurrentPage((prev) => (prev + 1) % totalPages);
  const handlePrevTestimonial = () =>
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  const toggleCategoryDropdown = () => setIsCategoryOpen((prev) => !prev);
  const toggleLocationDropdown = () => setIsLocationOpen((prev) => !prev);

  return (
    <main className="min-h-screen">
      <HeroWithNavbar
        isCategoryOpen={isCategoryOpen}
        isLocationOpen={isLocationOpen}
        toggleCategoryDropdown={toggleCategoryDropdown}
        toggleLocationDropdown={toggleLocationDropdown}
        handleCategoryChange={handleCategoryChange}
        handleLocationChange={handleLocationChange}
        onSearch={handleSearch}
        showSearch={true}
        heading="Simplify Your Event Planning with <br /> All-in-One Booking."
        subheading="Book stunning venues and top-notch catering services effortlessly."
      />
      <Features
        heading="Your One-Stop Solution for Event Planning"
        description="Discover and book the perfect event center with ease. Customize your experience by adding services and making secure payments all in one place."
        imageSrc="/event.png"
      />
      <FeaturedVenues heading="Featured Event Centers" />
      <div className="bg-white">
        <CateringServices />
      </div>
      <ElevateEvents />
      <EventPlanning />
      <BookEvent />
      <Testimonials
        testimonials={testimonials}
        currentPage={currentPage}
        testimonialsPerPage={testimonialsPerPage}
        totalPages={totalPages}
        handleNextTestimonial={handleNextTestimonial}
        handlePrevTestimonial={handlePrevTestimonial}
        setCurrentPage={setCurrentPage}
      />
      <EventGallery />
      <PlanNextEvent />
      <Footer />
    </main>
  );
}

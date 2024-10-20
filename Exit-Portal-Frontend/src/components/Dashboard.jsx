import React, { useState,useEffect } from 'react';
import CategoryList from './CategoryList';
import Summary from './Summary';
import CategoryDetailsPopup from './CategoryDetailsPopup';
import CustomNavbar from "./Navbar"; 
import axios from 'axios';



const dummyData = {
  name: 'John Doe',
  id:'12345',
  photoUrl:'https://th.bing.com/th?id=OIP.rD-OwfGd7YhZlFARYIUp-wHaHZ&w=250&h=249&c=8&rs=1&qlt=90&r=0&o=6&dpr=2&pid=3.1&rm=2',
  certificateEligible: false,
  specializationCompleted: false,
  categories: [
    {
      name: 'Humanities & Social Sciences (HSS)',
      minCourses: 6,
      totalCredits: 12,
      earnedCredits: 10,
      courses: [
        { name: 'HSS Course 1', completed: true },
        { name: 'HSS Course 2', completed: false },
        { name: 'HSS Course 3', completed: true },
        { name: 'HSS Course 4', completed: true },
        { name: 'HSS Course 5', completed: true },
        { name: 'HSS Course 6', completed: false },
      ],
    },
    {
      name: 'Basic Sciences (BS)',
      minCourses: 7,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'BS Course 1', completed: true },
        { name: 'BS Course 2', completed: true },
        { name: 'BS Course 3', completed: true },
        { name: 'BS Course 4', completed: true },
        { name: 'BS Course 5', completed: true },
        { name: 'BS Course 6', completed: true },
        { name: 'BS Course 7', completed: true },
      ],
    },
    {
      name: 'Engineering Sciences (ES)',
      minCourses: 7,
      totalCredits: 25.5,
      earnedCredits: 24.5,
      courses: [
        { name: 'ES Course 1', completed: true },
        { name: 'ES Course 2', completed: true },
        { name: 'ES Course 3', completed: true },
        { name: 'ES Course 4', completed: false },
        { name: 'ES Course 5', completed: true },
        { name: 'ES Course 6', completed: true },
        { name: 'ES Course 7', completed: true },
      ],
    },
    {
      name: 'Professional Core (PC)',
      minCourses: 10,
      totalCredits: 34,
      earnedCredits: 30,
      courses: [
        { name: 'PC Course 1', completed: true },
        { name: 'PC Course 2', completed: true },
        { name: 'PC Course 3', completed: true },
        { name: 'PC Course 4', completed: false },
        { name: 'PC Course 5', completed: true },
        { name: 'PC Course 6', completed: false },
        { name: 'PC Course 7', completed: true },
        { name: 'PC Course 8', completed: true },
        { name: 'PC Course 9', completed: true },
        { name: 'PC Course 10', completed: true },
      ],
    },
    {
      name: 'Skill Development Core Courses (SDC)',
      minCourses: 4,
      totalCredits: 7,
      earnedCredits: 7,
      courses: [
        { name: 'SDC Course 1', completed: true },
        { name: 'SDC Course 2', completed: true },
        { name: 'SDC Course 3', completed: true },
        { name: 'SDC Course 4', completed: true },
      ],
    },
    {
      name: 'Skill Development Electives (SDC ELEC)',
      minCourses: 1,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'BS Course 1', completed: true },
      ],
    },
    {
      name: 'Professional Electives',
      minCourses: 5,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'PE Course 1', completed: true },
        { name: 'PE Course 2', completed: true },
        { name: 'PE Course 3', completed: true },
        { name: 'PE Course 4', completed: true },
        { name: 'PE Course 5', completed: true },
      ],
    },
    {
      name: 'Flexi Core Courses(FXC)',
      minCourses: 2,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'FXC Course 1', completed: true },
        { name: 'FXC Course 2', completed: true },
      ],
    },
    {
      name: 'Project Courses(PR)',
      minCourses: 5,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'PR Course 1', completed: true },
        { name: 'PR Course 2', completed: true },
        { name: 'PR Course 3', completed: true },
        { name: 'PR Course 4', completed: true },
        { name: 'PR Course 5', completed: true },
      ],
    },
    {
      name: 'Physics Elective(PHY)',
      minCourses: 1,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'PHY Course 1', completed: true },
      ],
    },
    {
      name: 'Chemistry Elective(CHE)',
      minCourses: 1,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'CHE Course 1', completed: true },
      ],
    },
    {
      name: 'Open Electives (OE)',
      minCourses: 3,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'OE Course 1', completed: true },
        { name: 'OE Course 2', completed: true },
        { name: 'OE Course 3', completed: true },
      ],
    },
    {
      name: 'Forigen Langauge Elective(FLE)',
      minCourses: 1,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'BS Course 1', completed: true },
      ],
    },
    {
      name: 'Management Elective(ME)',
      minCourses: 1,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'ME Course 1', completed: true },
      ],
    },
    {
      name: 'Audit Courses(AUD)',
      minCourses: 4,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'AUD Course 1', completed: true },
        { name: 'AUD Course 2', completed: true },
        { name: 'AUD Course 3', completed: true },
        { name: 'AUD Course 4', completed: true },
      ],
    },
    {
      name: 'Value Added Courses(VAC)',
      minCourses: 4,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'VAC Course 1', completed: true },
        { name: 'VAC Course 2', completed: true },
        { name: 'VAC Course 3', completed: true },
        { name: 'VAC Course 4', completed: true },
      ],
    },
    {
      name: 'Social Service Activites',
      minCourses: 7,
      totalCredits: 20.5,
      earnedCredits: 20.5,
      courses: [
        { name: 'BS Course 1', completed: true },
        { name: 'BS Course 2', completed: true },
        { name: 'BS Course 3', completed: true },
        { name: 'BS Course 4', completed: true },
        { name: 'BS Course 5', completed: true },
        { name: 'BS Course 6', completed: true },
        { name: 'BS Course 7', completed: true },
      ],
    },
  ],
};


const Dashboard = ({studentId}) => {
  const [data,setData] = useState(null);


  useEffect(() => {
    axios
      .post("http://localhost:8080/api/v1/frontend/login", { universityid: String(studentId) })
      .then(res => setData(res.data))
      .catch(err => console.error(err));
  }, []);




  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleShowPopup = (category) => {
    setSelectedCategory(category);
    setPopupVisible(true);
  };

  const handleClosePopup = () => {
    setPopupVisible(false);
    setSelectedCategory(null);
  };
  console.log(studentId);

  return (
    <div className="dashboard">
      <h2>Student Dashboard</h2>
      <CustomNavbar  data={data} />
      <Summary data={data} StudentId={studentId} />
      <CategoryList
        categories={data}
        onShowPopup={handleShowPopup}
      />
      {popupVisible && (
        <CategoryDetailsPopup
          category={selectedCategory}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
};

export default Dashboard;

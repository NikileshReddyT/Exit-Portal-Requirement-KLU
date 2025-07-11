import React, { useState } from 'react';
import Header from './Header';
import Footer from './Footer';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Styles/Login.css';
import logo from '../images/Frame 1 NR.png'; // Update with the path to your logo

const Login = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        const response = await axios.post('https://keen-radiance-production.up.railway.app/api/v1/frontend/login', {
            universityId: id,
            password: password
        });

        if (response.data && response.data.universityid) {
            localStorage.clear();
            localStorage.setItem('studentId', response.data.universityid);
            navigate('/dashboard');
        } else {
            setError('Unexpected response from server.');
        }
    } catch (err) {
        if (err.response) {
            if (err.response.status === 401) {
                setError('Incorrect password. Please enter the correct password.');
            } else if (err.response.status === 404) {
                setError('USER NOT FOUND.');
            } else {
                setError('An unexpected error occurred. Please try again later.');
            }
        } else {
            setError('Network error. Please check your internet connection.');
        }
    } finally {
        setLoading(false);
    }
};

  return (
    <div>
      <Header />
      <div className="login animate-fade-in">
      <div className='portal-details'>


      <div className="intro-container">
        <h3>KL University</h3>
        <p>
          KL University, a renowned institution dedicated to providing quality education and fostering innovation, 
          is committed to empowering students with the knowledge and skills needed to excel in their respective fields.
          With a vibrant campus, experienced faculty, and a range of academic programs, KL University stands as a 
          beacon of learning and development.
        </p>
        
        <h3>Exit Graduation Eligibility Portal</h3>
        <p className="left-aligned">
          This portal is designed specifically for KL University students to check their eligibility for graduation 
          based on the number of credits and courses completed across various categories. 
          The portal also considers individual specialization requirements, ensuring a comprehensive evaluation of 
          each student's academic journey.
        </p>
        <p className="left-aligned">
          By logging into this portal, you can easily access your academic records, check your credit status, 
          and generate reports necessary for graduation requirements. Please log in using your Student ID and 6 digit pin sent to your college email.
        </p>
      </div>
      </div>
        <div className="login-container">
          <img src={logo} alt="University Logo" className="logo" />
          <h2>Student Login</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Enter Student ID" // Add placeholder for clarity
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Enter 6 digit pin" // Add placeholder for clarity
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? <div className="button-spinner" /> : 'Login'}
            </button>
          </form>
          {error && <p className="error-message">{error}</p>}
          <p className="forgot-password" onClick={() => alert('Reset password functionality coming soon!')}>
            Forgot Password?
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;

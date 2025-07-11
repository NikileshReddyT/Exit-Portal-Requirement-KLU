import React from 'react';
import KLlogo from '../../images/Frame 1 NR.png'; // Correct path

const Header = () => {
  return (
    <div>
      <header>
        {/* <img src={KLlogo} alt='Logo' className='logo' /> */}
        <h1>Exit Requirement Portal <span className='header-hiph'>-</span><span className='header-br'><br/></span> KL University</h1>
      </header>
    </div>
  );
};

export default Header;

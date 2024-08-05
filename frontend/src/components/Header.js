import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faFolder } from '@fortawesome/free-solid-svg-icons';

const HeaderContainer = styled.header`
  background-color: #333333;
  color: #ffffff;
  padding: 1.5rem;
  margin-bottom: 2.5rem;
  border-bottom: 4px solid #0078d7;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  transition: background-color 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    background-color: #282828;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  border-radius: 5px;
`;

const NavLink = styled(Link)`
  color: #ffffff;
  text-decoration: none;
  margin-right: 1.5rem;
  font-size: 1.1rem;
  font-weight: 500;
  transition: color 0.3s ease, transform 0.3s ease;

  &:hover {
    color: #33c3f0;
    text-decoration: underline;
    transform: scale(1.05);
  }

  &:last-child {
    margin-right: 0;
  }

  &:active {
    color: #1a73e8;
  }
`;

const Header = () => {
  return (
    <HeaderContainer>
      <Nav>
        <div>
          <NavLink to="/"><FontAwesomeIcon icon={faHome} /> Dashboard</NavLink>
          <NavLink to="/cases"><FontAwesomeIcon icon={faFolder} /> Cases</NavLink>
        </div>
      </Nav>
    </HeaderContainer>
  );
};

export default Header;
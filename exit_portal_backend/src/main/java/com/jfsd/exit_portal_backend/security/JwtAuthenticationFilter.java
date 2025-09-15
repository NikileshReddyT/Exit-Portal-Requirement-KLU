package com.jfsd.exit_portal_backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        // Try cookie first
        String jwt = parseJwtFromCookie(request);

        // Fallback: try Authorization header (helps Safari and other browsers when cookies are blocked)
        if (jwt == null) {
            jwt = parseJwtFromAuthorizationHeader(request);
        }
        
        if (jwt != null && jwtUtil.validateJwtToken(jwt)) {
            String username = jwtUtil.getUsernameFromJwtToken(jwt);
            String role = jwtUtil.getRoleFromJwtToken(jwt);
            String userType = jwtUtil.getUserTypeFromJwtToken(jwt);
            
            // Create authority based on role
            String authority = "ROLE_" + (userType != null ? userType : role);
            SimpleGrantedAuthority grantedAuthority = new SimpleGrantedAuthority(authority);
            
            UsernamePasswordAuthenticationToken authentication = 
                new UsernamePasswordAuthenticationToken(username, null, Collections.singletonList(grantedAuthority));
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }
        
        filterChain.doFilter(request, response);
    }
    
    private String parseJwtFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private String parseJwtFromAuthorizationHeader(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || authHeader.isBlank()) {
            return null;
        }
        // Support standard "Bearer <token>" header
        if (authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authHeader.substring(7).trim();
        }
        return null;
    }
}

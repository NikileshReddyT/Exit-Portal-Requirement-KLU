package com.jfsd.exit_portal_backend.dto;

public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String message) { super(message); }
}

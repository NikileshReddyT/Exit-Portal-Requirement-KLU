package com.jfsd.exit_portal_backend.dto;

public class InvalidPasswordException extends RuntimeException {
    public InvalidPasswordException(String message) { super(message); }
}

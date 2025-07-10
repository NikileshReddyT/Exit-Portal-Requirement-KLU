package com.jfsd.exit_portal_backend.RequestBodies;

public class Login {

    private String universityId;
    private String password;

    public String getUniversityId() {
        return universityId;
    }

    public void setUniversityId(String universityId) {
        this.universityId = universityId;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}

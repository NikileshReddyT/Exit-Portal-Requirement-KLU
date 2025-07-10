package com.jfsd.exit_portal_backend.RequestBodies;

import com.fasterxml.jackson.annotation.JsonProperty;

public class Student {

    @JsonProperty("universityid")
    private String universityId;

    public String getUniversityId() {
        return universityId;
    }

    public void setUniversityId(String universityId) {
        this.universityId = universityId;
    }
}

package com.jfsd.exit_portal_backend.Controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    // Minimal body for cron-job.org; consistent small output
    @GetMapping(value = "/", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> rootGet() {
        return ResponseEntity.ok("OK");
    }

    // Zero-body variant if the monitor sends HEAD
    @RequestMapping(value = "/", method = RequestMethod.HEAD)
    public ResponseEntity<Void> rootHead() {
        return ResponseEntity.noContent().build();
    }

    // Optional dedicated cron ping route if you want to switch the monitor URL
    @GetMapping(value = "/cron/ping", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> cronPing() {
        return ResponseEntity.ok("OK");
    }
}

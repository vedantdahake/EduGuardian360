document.addEventListener("DOMContentLoaded", () => {
    // Check if already logged in and redirect
    if (localStorage.getItem("user_rfid")) {
        window.location.href = "dashboard.html";
    }

    const loginForm = document.getElementById("loginForm");
    const errorMessage = document.getElementById("errorMessage");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const rfid = document.getElementById("rfid").value;
        const parentName = document.getElementById("parentName").value;
        const btn = document.querySelector(".btn-blue");

        try {
            btn.innerHTML = "Logging in...";
            btn.disabled = true;

            const response = await fetch("http://localhost:3000/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ rfid: rfid, parent_name: parentName })
            });

            const data = await response.json();

            if (response.ok) {
                // Save user details
                localStorage.setItem("user_rfid", rfid);
                localStorage.setItem("parent_name", parentName);
                localStorage.setItem("child_name", data.user.child_name);
                localStorage.setItem("bus_id", data.user.bus_id);

                window.location.href = "dashboard.html";
            } else {
                errorMessage.style.display = "block";
                errorMessage.innerText = data.message || "Invalid credentials";
                btn.innerHTML = "Login to Dashboard";
                btn.disabled = false;
            }

        } catch (error) {
            console.error("Error during login:", error);
            errorMessage.style.display = "block";
            errorMessage.innerText = "Error connecting to server.";
            btn.innerHTML = "Login to Dashboard";
            btn.disabled = false;
        }
    });
});

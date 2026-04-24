const openMenu = document.getElementById("openMenu");
const closeMenu = document.getElementById("closeMenu");
const menuEmergent = document.getElementById("menuEmergent");

openMenu.addEventListener("click", function () {
    menuEmergent.classList.add("mostrar");
});

closeMenu.addEventListener("click", function () {
    menuEmergent.classList.remove("mostrar");
});

menuEmergent.addEventListener("click", function (e) {
    if (e.target === menuEmergent) {
        menuEmergent.classList.remove("mostrar");
    }
});
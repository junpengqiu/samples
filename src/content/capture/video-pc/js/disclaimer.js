var modal = document.getElementById("myModal");
var btn = document.getElementById("acceptBtn");

if (!localStorage.getItem('disclaimerAccepted')) {
  modal.style.display = "block";
}

btn.onclick = function() {
  modal.style.display = "none";
  localStorage.setItem('disclaimerAccepted', true);
}

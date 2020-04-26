<script>
    export let position;
    export let company;
    export let companyLink;
    export let startDate;
    export let endDate;
    export let location;
    export let description;
</script>

<div class="modal-text">
    <h1 class="modal-text">{position}</h1>
    <a href={companyLink} target="_blank"><h2 class="modal-text">{company}</h2></a>
    <h3 class="modal-text">{startDate}</h3><b>-</b><h3 class="modal-text">{endDate}</h3>
    <h3 class="modal-text">{location}</h3>
    <p class="modal-text">{@html description}</p>
</div>
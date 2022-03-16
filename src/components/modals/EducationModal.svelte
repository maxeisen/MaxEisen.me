<script>
    export let school;
    export let location;
    export let degree;
    export let major;
    export let years;
    export let courses;
    export let committees;
</script>

<div class="education-modal">
    <h1 class="modal-school" style="text-align: center;">{school} ({location})</h1>
    <h2 class="modal-degree" style="text-align: center;">{@html degree}</h2>
    <h3 class="modal-major" style="text-align: center;">{@html major}</h3>
    <h3 class="modal-years" style="text-align: center;">{years}</h3>
    <p class="modal-committees"><b>Relevant Courses: </b>{courses}</p>
    <p class="modal-committees"><b>Committees: </b>{committees}</p>
    <p class="ta-note">*Acted as a Teaching Assistant (courses) or Executive (committees)</p>
</div>

<style>
    .education-modal {
        color: black;
    }

    .modal-school {
        font-size: 35px;
        margin: 15px auto 5px auto;
        color: var(--modal-title-colour);
    }

    .modal-degree {
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
        color: var(--modal-title-colour);
        font-size: 25px;
        margin: 0px auto 5px auto;

    }

    .modal-degree:hover {
        font-size: 25px;
        margin-top: 5px;
    }

    .modal-major {
        font-size: 20px;
        margin: 0 auto 0 auto;
        color: var(--modal-title-colour);
        line-height: 1.4;
    }

    .modal-years {
        margin: 10px auto 10px auto;
        color: var(--modal-subtitle-colour);
        line-height: 1.4;
    }

    .modal-committees {
        font-size: 15px;
        text-align: center;
        margin: 10px auto 10px auto;
        color: var(--modal-text-colour);
        line-height: 1.4;
    }

    .ta-note {
        margin-top: 20px;
        font-size: 11px;
    }
</style>
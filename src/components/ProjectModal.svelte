<script>
    export let name;
    export let technologies;
    export let year;
    export let description;
    export let githubLink;
    export let projectLink;
    export let screenshot;
</script>

<div class="project-modal">
    <h1 class="modal-name"><a href={projectLink} target="_blank">{name}</a> ({year})</h1>
    <h3 class="modal-description" style="text-align: center">Technologies: <b class="technologies">{technologies}</b></h3>
    <p class="modal-description">{@html description}</p>
    <img class="screenshot" src={screenshot} alt="{name} screenshot">
    <a href={githubLink} target="_blank"><h2 class="github-link">View Code</h2></a>
</div>

<style>
    .project-modal {
        color: black;
    }

    .modal-name {
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
        color: rgb(0, 49, 82);
        font-size: 35px;
        margin: 15px 15px 10px 15px;
        color: black;
    }

    .technologies {
        font-weight: 300;
    }

    .modal-description {
        margin: 10px auto 10px auto;
        color: black;
        line-height: 1.4;
    }

    .screenshot {
        width: 100%;
        height: auto;
        border-radius: 5px;
        box-shadow: 0px 0px 10px #0000009a;
        margin: 20px auto 0 auto;
    }

    .github-link {
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
        color: rgb(0, 49, 82);
        font-size: 25px;
        margin: 20px auto 10px auto;
    }

    .github-link:hover {
        color: #01c0a7;
        font-size: 25px;
    }
</style>
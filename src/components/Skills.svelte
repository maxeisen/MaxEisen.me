<script>
    import { skills } from '../../public/content/skills.js';
</script>

<h1 class="section-title" id="skills" style="text-align: left;">Skills</h1>
<div class="skills-subsection">
    <ul>
        {#each skills as skill}
            <li>{skill}</li>
        {/each}
    </ul>
</div>

<style>
    ul {
        text-align: left;
        color: var(--paragraph-colour);
        font-size: 20px;
        list-style: none;
        -webkit-column-count: 4;
        -moz-column-count: 4;
        column-count: 4;
    }

    ul li::before {
        -webkit-transition: all .1s ease-in;
        -moz-transition: all .1s ease-in;
        -o-transition: all .1s ease-in;
        -ms-transition: all .1s ease-in;
        transition: all .1s ease-in;
        content: "\2022";
        color: var(--skill-bullet-colour);
        display: inline-block;
        width: 1em;
        margin-left: -0.5em;
    }

    ul li:hover::before {
        color: var(--main-green);
    }

    @media only screen and (max-width: 1270px) {
        ul {
        -webkit-column-count: 3;
        -moz-column-count: 3;
        column-count: 3;
        }
    }

    @media only screen and (max-width: 1100px) {
        ul {
        font-size: 18px;
        -webkit-column-count: 2;
        -moz-column-count: 2;
        column-count: 2;
        }
    }

    @media only screen and (max-width: 860px) {
        ul {
        -webkit-column-count: 4;
        -moz-column-count: 4;
        column-count: 4;
        }
    }

    @media only screen and (max-width: 600px) {
        ul {
        font-size: 18px;
        -webkit-column-count: 3;
        -moz-column-count: 3;
        column-count: 3;
        }
    }

    @media only screen and (max-width: 470px) {
        ul {
        text-align: center;
        font-size: 18px;
        -webkit-column-count: 2;
        -moz-column-count: 2;
        column-count: 2;
        margin-left: -2em;
        }

        ul li::before {
        display: none;
    }
    }
</style>
<label class="toggle-control">
    <input type="checkbox" checked="checked" id="theme-toggle">
    <span class="control"></span>
</label>

<style>
.toggle-control {
    padding-left: 100px;
    margin-bottom: 12px;
    cursor: pointer;
    font-size: 10px;
    -webkit-user-select: none;
       -moz-user-select: none;
        -ms-user-select: none;
            user-select: none;
}
.toggle-control input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
}
.toggle-control input:checked ~ .control {
    background-color: #00b89e;
}
.toggle-control input:checked ~ .control:after {
    left: 27px;
}
.toggle-control .control {
    position: absolute;
    top: 0;
    left: 0;
    height: 25px;
    width: 50px;
    border-radius: 25px;
    background-color: #004037;
    transition: background-color 0.15s ease-in;
}
.toggle-control .control:after {
    content: "";
    position: absolute;
    left: 3px;
    top: 3px;
    width: 20px;
    height: 20px;
    border-radius: 25px;
    background: white;
    transition: left 0.15s ease-in;
}
</style>